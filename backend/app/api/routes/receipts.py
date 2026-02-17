from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    CashierCreate,
    ReceiptCreate,
    ReceiptItem,
    ReceiptItemInlineCreate,
    ReceiptItemRead,
    ReceiptRead,
    ReceiptSource,
    ReceiptWithItemsCreate,
    ReceiptWithItemsPublic,
    ShopCreate,
    ShopOwnerCreate,
)
from app.servises.cashier import get_or_create_cashier
from app.servises.receipt import create_receipt_with_items
from app.servises.shop import get_or_create_shop
from app.servises.shop_owner import get_or_create_shop_owner

router = APIRouter(prefix="/receipts", tags=["receipts"])


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


@router.post("/raw", response_model=ReceiptWithItemsPublic)
def create_receipt_from_raw(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: dict[str, Any] | list[dict[str, Any]] = Body(...),
) -> Any:
    """
    Parse raw FNS-like JSON and create receipt with nested items.
    """
    try:
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
        if isinstance(operator, str) and isinstance(operator_inn, str):
            cashier = get_or_create_cashier(
                session=session,
                cashier_in=CashierCreate(name=operator, inn=operator_inn),
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
        session.commit()

        db_items = session.exec(
            select(ReceiptItem).where(ReceiptItem.receipt_id == created.id)
        ).all()
        return ReceiptWithItemsPublic(
            receipt=ReceiptRead.model_validate(created),
            items=[ReceiptItemRead.model_validate(i) for i in db_items],
        )
    except HTTPException:
        if session.in_transaction():
            session.rollback()
        raise
    except ValueError as exc:
        if session.in_transaction():
            session.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
