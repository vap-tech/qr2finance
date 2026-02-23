import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Receipt,
    ReceiptItem,
    ReceiptItemCategoryLink,
    ReceiptItemCreate,
    ReceiptItemGroupPublic,
    ReceiptItemGroupsPublic,
    ReceiptItemPublic,
    ReceiptItemUpdate,
    SetReceiptItemCategories,
    SetReceiptItemsCategoriesByName,
)
from app.servises.receipt import recalculate_receipt_payment_totals
from app.servises.receipt_item import (
    get_receipt_item_owner_id,
    get_receipt_item_public,
    set_receipt_item_categories,
    set_receipt_items_categories_by_name,
)

router = APIRouter(prefix="/receipt-items", tags=["receipt-items"])


def _receipt_item_query_for_user(current_user: CurrentUser):
    base = select(ReceiptItem).join(
        Receipt,
        col(Receipt.id) == col(ReceiptItem.receipt_id),
    )
    if current_user.is_superuser:
        return base
    return base.where(col(Receipt.owner_id) == current_user.id)


def _get_receipt_item_or_404(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> ReceiptItem:
    if current_user.is_superuser:
        item = session.get(ReceiptItem, item_id)
    else:
        item = session.exec(
            select(ReceiptItem)
            .join(Receipt, col(Receipt.id) == col(ReceiptItem.receipt_id))
            .where(
                col(ReceiptItem.id) == item_id,
                col(Receipt.owner_id) == current_user.id,
            )
        ).one_or_none()

    if not item:
        raise HTTPException(status_code=404, detail="Receipt item not found")
    return item


@router.get("/", response_model=ReceiptItemGroupsPublic)
def read_receipt_items(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    sort: Literal["name", "quantity", "sum"] = "name",
    order: Literal["asc", "desc"] = "asc",
    date_from: date | None = None,
    date_to: date | None = None,
    category_ids: list[uuid.UUID] | None = Query(default=None),
) -> Any:
    base = _receipt_item_query_for_user(current_user)

    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be <= date_to")

    if date_from:
        dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        base = base.where(col(Receipt.date_time) >= dt_from)

    if date_to:
        dt_to_exclusive = datetime.combine(
            date_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        base = base.where(col(Receipt.date_time) < dt_to_exclusive)

    if category_ids:
        category_item_ids = select(ReceiptItemCategoryLink.receipt_item_id).where(
            col(ReceiptItemCategoryLink.category_id).in_(category_ids)
        )
        base = base.where(col(ReceiptItem.id).in_(category_item_ids))  # type: ignore[arg-type]

    name_col = col(ReceiptItem.name)
    quantity_col = func.sum(col(ReceiptItem.quantity))
    sum_col = func.sum(col(ReceiptItem.sum))
    items_count_col = func.count(col(ReceiptItem.id))

    sort_map = {
        "name": name_col,
        "quantity": quantity_col,
        "sum": sum_col,
    }
    sort_expr = sort_map[sort]
    order_expr = sort_expr.desc() if order == "desc" else sort_expr.asc()

    grouped = (
        base.with_only_columns(
            name_col.label("name"),
            quantity_col.label("quantity"),
            sum_col.label("sum"),
            items_count_col.label("items_count"),
        )
        .group_by(name_col)
        .order_by(order_expr, name_col.asc())
    )

    count = session.exec(select(func.count()).select_from(grouped.subquery())).one()
    rows = session.execute(grouped.offset(skip).limit(limit)).all()

    data: list[ReceiptItemGroupPublic] = []
    for row in rows:
        mapping = row._mapping
        data.append(
            ReceiptItemGroupPublic(
                name=str(mapping["name"]),
                quantity=float(mapping["quantity"] or 0),
                sum=int(mapping["sum"] or 0),
                items_count=int(mapping["items_count"] or 0),
            )
        )
    return ReceiptItemGroupsPublic(data=data, count=count)


@router.get("/{item_id}", response_model=ReceiptItemPublic)
def read_receipt_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> Any:
    item = _get_receipt_item_or_404(session, current_user, item_id)
    owner_id = session.exec(
        select(Receipt.owner_id).where(col(Receipt.id) == item.receipt_id)
    ).one()
    return get_receipt_item_public(
        session=session,
        owner_id=owner_id,
        receipt_item_id=item.id,
    )


@router.post("/", response_model=ReceiptItemPublic)
def create_receipt_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_in: ReceiptItemCreate,
) -> Any:
    receipt = session.get(Receipt, item_in.receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not current_user.is_superuser and receipt.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    item = ReceiptItem(**item_in.model_dump())
    session.add(item)
    session.flush()
    recalculate_receipt_payment_totals(session, receipt=receipt)
    session.commit()
    return get_receipt_item_public(
        session=session,
        owner_id=receipt.owner_id,
        receipt_item_id=item.id,
    )


@router.put("/{item_id}", response_model=ReceiptItemPublic)
def update_receipt_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    item_in: ReceiptItemUpdate,
) -> Any:
    item = _get_receipt_item_or_404(session, current_user, item_id)
    receipt = session.get(Receipt, item.receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    update_dict = item_in.model_dump(exclude_unset=True)
    update_dict.pop("receipt_id", None)
    if "name" in update_dict and update_dict["name"] is not None:
        update_dict["name"] = update_dict["name"].strip()

    item.sqlmodel_update(update_dict)
    session.add(item)
    session.flush()
    recalculate_receipt_payment_totals(session, receipt=receipt)
    session.commit()
    return get_receipt_item_public(
        session=session,
        owner_id=receipt.owner_id,
        receipt_item_id=item.id,
    )


@router.delete("/{item_id}", response_model=Message)
def delete_receipt_item(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
) -> Message:
    item = _get_receipt_item_or_404(session, current_user, item_id)
    receipt = session.get(Receipt, item.receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    session.delete(item)
    session.flush()
    recalculate_receipt_payment_totals(session, receipt=receipt)
    session.commit()
    return Message(message="Receipt item deleted successfully")


@router.put("/{item_id}/categories", response_model=ReceiptItemPublic)
def replace_receipt_item_categories(
    session: SessionDep,
    current_user: CurrentUser,
    item_id: uuid.UUID,
    body: SetReceiptItemCategories,
) -> Any:
    receipt_item = _get_receipt_item_or_404(session, current_user, item_id)
    owner_id = get_receipt_item_owner_id(session, receipt_item_id=receipt_item.id)

    try:
        set_receipt_item_categories(
            session=session,
            owner_id=owner_id,
            receipt_item_id=receipt_item.id,
            category_ids=body.category_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return get_receipt_item_public(
        session=session,
        owner_id=owner_id,
        receipt_item_id=receipt_item.id,
    )


@router.put("/categories/by-name", response_model=Message)
def replace_receipt_items_categories_by_name(
    session: SessionDep,
    current_user: CurrentUser,
    body: SetReceiptItemsCategoriesByName,
) -> Message:
    owner_id = current_user.id

    try:
        affected = set_receipt_items_categories_by_name(
            session=session,
            owner_id=owner_id,
            item_name=body.name,
            category_ids=body.category_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return Message(message=f"Updated categories for {affected} receipt items")
