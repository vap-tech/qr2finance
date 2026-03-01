import io
import json
import os
import tempfile
import uuid
import zipfile
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, cast

from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import col, func, select
from starlette.background import BackgroundTask

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    CashierCreate,
    CashierPublic,
    Message,
    Receipt,
    ReceiptCreate,
    ReceiptImportError,
    ReceiptImportSummary,
    ReceiptItem,
    ReceiptItemInlineCreate,
    ReceiptItemRead,
    ReceiptRawBackup,
    ReceiptRead,
    ReceiptShopUpdate,
    ReceiptShort,
    ReceiptSource,
    ReceiptsShortPublic,
    ReceiptWithItemsCreate,
    ReceiptWithItemsFullPublic,
    ReceiptWithItemsPublic,
    Shop,
    ShopCreate,
    ShopOwnerCreate,
    ShopOwnerPublic,
    ShopRead,
)
from app.servises.cashier import UNKNOWN_CASHIER_INN, get_or_create_cashier
from app.servises.receipt import (
    create_receipt_with_items,
    recalculate_receipt_payment_totals,
)
from app.servises.shop import get_or_create_shop
from app.servises.shop_owner import get_or_create_shop_owner

router = APIRouter(prefix="/receipts", tags=["receipts"])

# Max characters for shop_display in short receipt list responses.
_SHOP_DISPLAY_LIMIT = 28


def _build_shop_display(shop: ShopRead | None) -> str | None:
    if shop is None:
        return None
    base = (shop.retail_name or "").strip()
    if not base:
        base = (shop.address or "").strip()
    if not base:
        return None
    if len(base) > _SHOP_DISPLAY_LIMIT:
        return base[: _SHOP_DISPLAY_LIMIT - 3].rstrip() + "..."
    return base


@router.get("/", response_model=ReceiptsShortPublic)
def read_receipts(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    item_name: str | None = None,
) -> Any:
    """
    Retrieve receipts (short view).
    """
    count_statement = select(func.count()).select_from(Receipt)
    statement = (
        select(Receipt, func.count(col(ReceiptItem.id)))
        .join(
            ReceiptItem,
            col(ReceiptItem.receipt_id) == col(Receipt.id),
            isouter=True,
        )
        .order_by(col(Receipt.date_time).desc())
        .offset(skip)
        .limit(limit)
        .group_by(col(Receipt.id))
    )
    if not current_user.is_superuser:
        count_statement = count_statement.where(
            col(Receipt.owner_id) == current_user.id
        )
        statement = statement.where(col(Receipt.owner_id) == current_user.id)

    if item_name := (item_name.strip() if item_name else None):
        item_exists = (
            select(1)
            .select_from(ReceiptItem)
            .where(
                col(ReceiptItem.receipt_id) == col(Receipt.id),
                col(ReceiptItem.name).ilike(f"%{item_name}%"),
            )
            .correlate(Receipt)
            .exists()
        )
        count_statement = count_statement.where(item_exists)
        statement = statement.where(item_exists)

    count = cast(int, session.exec(count_statement).one())
    rows = cast(list[tuple[Receipt, int]], session.exec(statement).all())

    data: list[ReceiptShort] = []
    for receipt, items_count in rows:
        shop = ShopRead.model_validate(receipt.shop) if receipt.shop else None
        data.append(
            ReceiptShort(
                id=receipt.id,
                date_time=receipt.date_time,
                total_sum=receipt.total_sum,
                cash_total_sum=receipt.cash_total_sum,
                ecash_total_sum=receipt.ecash_total_sum,
                items_count=int(items_count),
                shop_display=_build_shop_display(shop),
                shop=shop,
            )
        )

    return ReceiptsShortPublic(data=data, count=count)


@router.get("/export")
def export_receipts(
    session: SessionDep,
    current_user: CurrentUser,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> FileResponse:
    """
    Export receipts as JSONL with raw payloads and source hashes.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be <= date_to")

    statement = (
        select(ReceiptRawBackup.source_hash, ReceiptRawBackup.raw_json)
        .join(Receipt, col(Receipt.id) == col(ReceiptRawBackup.receipt_id))
        .order_by(col(Receipt.date_time).asc())
    )

    if not current_user.is_superuser:
        statement = statement.where(col(ReceiptRawBackup.owner_id) == current_user.id)

    if date_from:
        dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        statement = statement.where(col(Receipt.date_time) >= dt_from)

    if date_to:
        dt_to_exclusive = datetime.combine(
            date_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        statement = statement.where(col(Receipt.date_time) < dt_to_exclusive)

    archive_date = date.today().isoformat()
    jsonl_name = f"receipts-{archive_date}.jsonl"
    zip_name = f"{jsonl_name}.zip"
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_path = temp_file.name
    temp_file.close()

    with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        with zip_file.open(jsonl_name, "w") as target:
            for source_hash, raw_json in session.exec(statement):
                payload = {"source_hash": source_hash, "raw_json": raw_json}
                target.write(
                    (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
                )

    return FileResponse(
        temp_path,
        media_type="application/zip",
        filename=zip_name,
        background=BackgroundTask(os.unlink, temp_path),
    )


@router.post("/import", response_model=ReceiptImportSummary)
def import_receipts(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Import receipts from JSONL with raw payloads and source hashes.
    """
    imported = 0
    skipped = 0
    failed = 0
    errors: list[ReceiptImportError] = []

    file.file.seek(0)
    if zipfile.is_zipfile(file.file):
        file.file.seek(0)
        try:
            with zipfile.ZipFile(file.file) as zip_file:
                names = zip_file.namelist()
                if not names:
                    raise HTTPException(status_code=422, detail="Empty zip archive")
                jsonl_name = next(
                    (name for name in names if name.lower().endswith(".jsonl")),
                    names[0],
                )
                extracted = zip_file.open(jsonl_name)
                stream: io.TextIOBase = io.TextIOWrapper(extracted, encoding="utf-8")
                for line_no, line in enumerate(stream, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        row = json.loads(line)
                        if not isinstance(row, dict):
                            raise ValueError("Row must be a JSON object")

                        raw_json = row.get("raw_json")
                        source_hash = row.get("source_hash")
                        if raw_json is None:
                            raise ValueError("raw_json is required")
                        if not isinstance(raw_json, dict):
                            raise ValueError("raw_json must be an object")
                        if source_hash is None:
                            source_hash = ReceiptRawBackup._compute_hash(raw_json)

                        exists = session.exec(
                            select(ReceiptRawBackup.id).where(
                                col(ReceiptRawBackup.source_hash) == source_hash
                            )
                        ).first()
                        if exists:
                            skipped += 1
                            continue

                        _create_receipt_from_raw_payload(
                            session=session,
                            current_user=current_user,
                            payload=raw_json,
                        )
                        imported += 1
                    except HTTPException as exc:
                        if session.in_transaction():
                            session.rollback()
                        failed += 1
                        errors.append(
                            ReceiptImportError(line=line_no, detail=str(exc.detail))
                        )
                    except Exception as exc:  # noqa: BLE001
                        if session.in_transaction():
                            session.rollback()
                        failed += 1
                        errors.append(ReceiptImportError(line=line_no, detail=str(exc)))
                return ReceiptImportSummary(
                    imported=imported,
                    skipped=skipped,
                    failed=failed,
                    errors=errors,
                )
        except (zipfile.BadZipFile, UnicodeDecodeError) as exc:
            raise HTTPException(
                status_code=422, detail="Invalid zip or encoding"
            ) from exc
    else:
        file.file.seek(0)
        try:
            stream = io.TextIOWrapper(file.file, encoding="utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=422, detail="File must be UTF-8") from exc

    for line_no, line in enumerate(stream, start=1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            if not isinstance(row, dict):
                raise ValueError("Row must be a JSON object")

            raw_json = row.get("raw_json")
            source_hash = row.get("source_hash")
            if raw_json is None:
                raise ValueError("raw_json is required")
            if not isinstance(raw_json, dict):
                raise ValueError("raw_json must be an object")
            if source_hash is None:
                source_hash = ReceiptRawBackup._compute_hash(raw_json)

            exists = session.exec(
                select(ReceiptRawBackup.id).where(
                    col(ReceiptRawBackup.source_hash) == source_hash
                )
            ).first()
            if exists:
                skipped += 1
                continue

            _create_receipt_from_raw_payload(
                session=session, current_user=current_user, payload=raw_json
            )
            imported += 1
        except HTTPException as exc:
            if session.in_transaction():
                session.rollback()
            failed += 1
            errors.append(ReceiptImportError(line=line_no, detail=str(exc.detail)))
        except Exception as exc:  # noqa: BLE001
            if session.in_transaction():
                session.rollback()
            failed += 1
            errors.append(ReceiptImportError(line=line_no, detail=str(exc)))

    return ReceiptImportSummary(
        imported=imported, skipped=skipped, failed=failed, errors=errors
    )


@router.get("/{id}", response_model=ReceiptWithItemsFullPublic)
def read_receipt(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """
    Get receipt by ID with items.
    """
    receipt = session.get(Receipt, id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not current_user.is_superuser and (receipt.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    db_items = session.exec(
        select(ReceiptItem).where(ReceiptItem.receipt_id == receipt.id)
    ).all()
    shop = ShopRead.model_validate(receipt.shop) if receipt.shop else None
    shop_owner = (
        ShopOwnerPublic.model_validate(receipt.shop.shop_owner)
        if receipt.shop and receipt.shop.shop_owner
        else None
    )
    cashier = CashierPublic.model_validate(receipt.cashier) if receipt.cashier else None
    return ReceiptWithItemsFullPublic(
        receipt=ReceiptRead.model_validate(receipt),
        items=[ReceiptItemRead.model_validate(i) for i in db_items],
        shop=shop,
        shop_owner=shop_owner,
        cashier=cashier,
    )


@router.delete("/{id}", response_model=Message)
def delete_receipt(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete receipt by ID (hard delete).
    """
    receipt = session.get(Receipt, id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not current_user.is_superuser and (receipt.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    session.delete(receipt)
    session.commit()
    return Message(message="Receipt deleted successfully")


@router.patch("/{id}/shop", response_model=ReceiptWithItemsFullPublic)
def update_receipt_shop(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    payload: ReceiptShopUpdate,
) -> Any:
    """
    Reassign receipt to another existing shop of the same owner.
    """
    receipt = session.get(Receipt, id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not current_user.is_superuser and (receipt.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    target_shop = session.get(Shop, payload.shop_id)
    if not target_shop or target_shop.owner_id != receipt.owner_id:
        raise HTTPException(
            status_code=422,
            detail="Target shop not found for this receipt owner",
        )
    if target_shop.is_active is False:
        raise HTTPException(status_code=422, detail="Target shop is inactive")

    receipt.shop_id = target_shop.id
    session.add(receipt)
    session.commit()
    session.refresh(receipt)

    db_items = session.exec(
        select(ReceiptItem).where(ReceiptItem.receipt_id == receipt.id)
    ).all()
    shop = ShopRead.model_validate(receipt.shop) if receipt.shop else None
    shop_owner = (
        ShopOwnerPublic.model_validate(receipt.shop.shop_owner)
        if receipt.shop and receipt.shop.shop_owner
        else None
    )
    cashier = CashierPublic.model_validate(receipt.cashier) if receipt.cashier else None
    return ReceiptWithItemsFullPublic(
        receipt=ReceiptRead.model_validate(receipt),
        items=[ReceiptItemRead.model_validate(i) for i in db_items],
        shop=shop,
        shop_owner=shop_owner,
        cashier=cashier,
    )


@router.post("/{id}/items", response_model=ReceiptWithItemsPublic)
def add_receipt_items(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    items: list[ReceiptItemInlineCreate] = Body(...),
) -> Any:
    """
    Add items to an existing receipt.
    """
    receipt = session.get(Receipt, id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not current_user.is_superuser and (receipt.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if len(items) == 0:
        raise HTTPException(status_code=422, detail="items list cannot be empty")

    for item_in in items:
        item = ReceiptItem(**item_in.model_dump(), receipt_id=receipt.id)
        session.add(item)

    session.flush()
    recalculate_receipt_payment_totals(session, receipt=receipt)
    session.commit()

    db_items = session.exec(
        select(ReceiptItem).where(ReceiptItem.receipt_id == receipt.id)
    ).all()
    return ReceiptWithItemsPublic(
        receipt=ReceiptRead.model_validate(receipt),
        items=[ReceiptItemRead.model_validate(i) for i in db_items],
    )


def _extract_raw_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, list):
        if len(payload) == 0:
            raise HTTPException(status_code=422, detail="Empty raw payload")
        payload = payload[0]

    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Raw payload must be JSON object")

    return payload


def _extract_receipt_data(raw_payload: dict[str, Any]) -> dict[str, Any]:
    try:
        ticket = raw_payload["ticket"]
        document = ticket["document"]
        receipt_data = document["receipt"]
    except (KeyError, TypeError):
        raise HTTPException(
            status_code=422,
            detail="Invalid raw payload: expected ticket.document.receipt",
        )

    if not isinstance(receipt_data, dict):
        raise HTTPException(status_code=422, detail="receipt must be an object")
    return receipt_data


def _save_raw_backup(
    *,
    session: SessionDep,
    owner_id: uuid.UUID,
    receipt_id: uuid.UUID,
    raw_payload: dict[str, Any],
) -> None:
    source_hash = ReceiptRawBackup._compute_hash(raw_payload)

    backup_by_hash = session.exec(
        select(ReceiptRawBackup).where(col(ReceiptRawBackup.source_hash) == source_hash)
    ).one_or_none()
    if backup_by_hash and backup_by_hash.receipt_id != receipt_id:
        raise ValueError("Raw payload already linked to another receipt")

    existing_backup = session.exec(
        select(ReceiptRawBackup).where(col(ReceiptRawBackup.receipt_id) == receipt_id)
    ).one_or_none()
    if existing_backup is None:
        session.add(
            ReceiptRawBackup(
                raw_json=raw_payload,
                source_hash=source_hash,
                owner_id=owner_id,
                receipt_id=receipt_id,
            )
        )
        return

    if existing_backup.source_hash != source_hash:
        existing_backup.raw_json = raw_payload
        existing_backup.update_hash()
        session.add(existing_backup)


def _parse_datetime(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str) or not value:
        raise HTTPException(status_code=422, detail=f"{field_name} is required")
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{field_name} has invalid format")


def _parse_receipt_create(
    receipt_data: dict[str, Any], *, shop_id: Any
) -> ReceiptCreate:
    try:
        return ReceiptCreate(
            date_time=_parse_datetime(receipt_data["dateTime"], "dateTime"),
            code=receipt_data["code"],
            cash_total_sum=receipt_data["cashTotalSum"],
            credit_sum=receipt_data["creditSum"],
            ecash_total_sum=receipt_data["ecashTotalSum"],
            total_sum=receipt_data["totalSum"],
            prepaid_sum=receipt_data.get("prepaidSum", 0),
            provision_sum=receipt_data.get("provisionSum", 0),
            fiscal_document_format_ver=receipt_data["fiscalDocumentFormatVer"],
            fiscal_drive_number=receipt_data["fiscalDriveNumber"],
            fiscal_document_number=receipt_data["fiscalDocumentNumber"],
            fiscal_sign=receipt_data["fiscalSign"],
            shift_number=receipt_data.get("shiftNumber"),
            kkt_reg_id=receipt_data.get("kktRegId", ""),
            nds_10=receipt_data.get("nds10"),
            nds_18=receipt_data.get("nds18"),
            operation_type=receipt_data["operationType"],
            request_number=receipt_data["requestNumber"],
            taxation_type=receipt_data.get("taxationType"),
            applied_taxation_type=receipt_data.get("appliedTaxationType"),
            shop_id=shop_id,
            source=ReceiptSource.FNS_IMPORT,
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=422, detail=f"Missing required field: {exc.args[0]}"
        )


def _infer_measure(name: str, quantity: float) -> str:
    if not float(quantity).is_integer():
        return "кг"
    if "кг" in name.lower():
        return "кг"
    return "шт"


def _parse_items(receipt_data: dict[str, Any]) -> list[ReceiptItemInlineCreate]:
    raw_items = receipt_data.get("items")
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raise HTTPException(status_code=422, detail="receipt.items is required")

    items: list[ReceiptItemInlineCreate] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            raise HTTPException(
                status_code=422, detail="receipt.items[] must be objects"
            )

        try:
            name = str(raw_item["name"])
            quantity = float(raw_item["quantity"])
            product_code_data = raw_item.get("productCodeData") or {}
            gtin = product_code_data.get("gtin")
            raw_product_code = product_code_data.get("rawProductCode")

            items.append(
                ReceiptItemInlineCreate(
                    name=name,
                    price=raw_item["price"],
                    quantity=quantity,
                    sum=raw_item["sum"],
                    measure=_infer_measure(name, quantity),
                    product_type=raw_item.get("productType"),
                    gtin=str(gtin) if gtin is not None else None,
                    raw_product_code=raw_product_code,
                )
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Missing required item field: {exc.args[0]}",
            )

    return items


def _create_receipt_from_raw_payload(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: dict[str, Any] | list[dict[str, Any]],
) -> Any:
    raw_payload = _extract_raw_payload(payload)
    receipt_data = _extract_receipt_data(raw_payload)

    user_name = receipt_data.get("user")
    user_inn = receipt_data.get("userInn")
    shop_owner_id = None
    if isinstance(user_name, str) and isinstance(user_inn, str):
        shop_owner = get_or_create_shop_owner(
            session=session,
            shop_owner_in=ShopOwnerCreate(name=user_name, inn=user_inn),
        )
        shop_owner_id = shop_owner.id  # type: ignore

    shop = get_or_create_shop(
        session=session,
        owner_id=current_user.id,
        shop_in=ShopCreate(
            retail_name=receipt_data.get("retailPlace"),
            address=receipt_data.get("retailPlaceAddress"),
            shop_owner_id=shop_owner_id,
        ),
    )
    if shop is None:
        raise HTTPException(
            status_code=422,
            detail="Shop fields are invalid (retailPlace and retailPlaceAddress are required)",
        )

    # For existing shops, backfill owner link if it was missing before.
    if shop_owner_id and shop.shop_owner_id is None:
        shop.shop_owner_id = shop_owner_id
        session.add(shop)

    cashier = None
    operator = receipt_data.get("operator")
    operator_inn = receipt_data.get("operatorInn")
    if isinstance(operator, str) and operator.strip() != "":
        normalized_operator_inn = (
            operator_inn.strip()
            if isinstance(operator_inn, str) and operator_inn.strip() != ""
            else UNKNOWN_CASHIER_INN
        )
        cashier = get_or_create_cashier(
            session=session,
            cashier_in=CashierCreate(name=operator, inn=normalized_operator_inn),
        )

    receipt_in = _parse_receipt_create(
        receipt_data,
        shop_id=shop.id,
    )
    if cashier is not None:
        receipt_in.cashier_id = cashier.id
    items_in = _parse_items(receipt_data)

    created = create_receipt_with_items(
        session=session,
        owner_id=current_user.id,
        payload=ReceiptWithItemsCreate(receipt=receipt_in, items=items_in),
    )
    _save_raw_backup(
        session=session,
        owner_id=current_user.id,
        receipt_id=created.id,
        raw_payload=raw_payload,
    )
    session.commit()

    db_items = session.exec(
        select(ReceiptItem).where(ReceiptItem.receipt_id == created.id)
    ).all()
    return ReceiptWithItemsPublic(
        receipt=ReceiptRead.model_validate(created),
        items=[ReceiptItemRead.model_validate(i) for i in db_items],
    )


def _load_payload_from_upload(file: UploadFile) -> Any:
    raw = file.file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="File must be UTF-8 JSON") from exc
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="File contains invalid JSON"
        ) from exc


@router.post("/raw-json", response_model=ReceiptWithItemsPublic)
def create_receipt_from_raw_json(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: dict[str, Any] | list[dict[str, Any]] = Body(...),
) -> Any:
    """
    Parse raw FNS-like JSON and create receipt with nested items.
    """
    try:
        return _create_receipt_from_raw_payload(
            session=session,
            current_user=current_user,
            payload=payload,
        )
    except HTTPException:
        if session.in_transaction():
            session.rollback()
        raise
    except ValueError as exc:
        if session.in_transaction():
            session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/raw-file", response_model=ReceiptWithItemsPublic)
def create_receipt_from_raw_file(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> Any:
    """
    Parse raw FNS-like JSON from uploaded file and create receipt with nested items.
    """
    try:
        payload = _load_payload_from_upload(file)
        return _create_receipt_from_raw_payload(
            session=session,
            current_user=current_user,
            payload=payload,
        )
    except HTTPException:
        if session.in_transaction():
            session.rollback()
        raise
    except ValueError as exc:
        if session.in_transaction():
            session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
