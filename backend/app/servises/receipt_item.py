import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, delete, func, select

from app.models import (
    Receipt,
    ReceiptItem,
    ReceiptItemCategory,
    ReceiptItemCategoryLink,
    ReceiptItemPublic,
)


def get_receipt_item_public(
    session: Session,
    *,
    owner_id: uuid.UUID,
    receipt_item_id: uuid.UUID,
) -> ReceiptItemPublic:
    receipt_item = session.exec(
        select(ReceiptItem)
        .join(Receipt, col(Receipt.id) == col(ReceiptItem.receipt_id))
        .where(
            col(ReceiptItem.id) == receipt_item_id,
            col(Receipt.owner_id) == owner_id,
        )
    ).one()

    cat_ids = session.exec(
        select(ReceiptItemCategoryLink.category_id).where(
            ReceiptItemCategoryLink.owner_id == owner_id,
            ReceiptItemCategoryLink.receipt_item_id == receipt_item_id,
        )
    ).all()

    return ReceiptItemPublic(
        id=receipt_item.id,
        receipt_id=receipt_item.receipt_id,
        name=receipt_item.name,
        price=receipt_item.price,
        quantity=receipt_item.quantity,
        sum=receipt_item.sum,
        measure=receipt_item.measure,
        product_type=receipt_item.product_type,
        gtin=receipt_item.gtin,
        raw_product_code=receipt_item.raw_product_code,
        category_ids=list(cat_ids),
    )


def get_receipt_item_owner_id(
    session: Session,
    *,
    receipt_item_id: uuid.UUID,
) -> uuid.UUID:
    return session.exec(
        select(Receipt.owner_id)
        .join(ReceiptItem, col(Receipt.id) == col(ReceiptItem.receipt_id))
        .where(col(ReceiptItem.id) == receipt_item_id)
    ).one()


def set_receipt_item_categories(
    session: Session,
    *,
    owner_id: uuid.UUID,
    receipt_item_id: uuid.UUID,
    category_ids: list[uuid.UUID],
) -> None:
    # dedupe, keep order
    category_ids = list(dict.fromkeys(category_ids))

    if category_ids:
        rows = session.exec(
            select(ReceiptItemCategory.id).where(
                ReceiptItemCategory.owner_id == owner_id,
                ReceiptItemCategory.id.in_(category_ids),  # type: ignore
                ReceiptItemCategory.is_active.is_(True),  # type: ignore
            )
        ).all()
        found = set(rows)
        missing = [cid for cid in category_ids if cid not in found]
        if missing:
            raise ValueError(f"Some categories not found: {missing}")

    session.exec(
        delete(ReceiptItemCategoryLink).where(
            col(ReceiptItemCategoryLink.owner_id) == owner_id,
            col(ReceiptItemCategoryLink.receipt_item_id) == receipt_item_id,
        )
    )  # type: ignore

    if category_ids:
        values = [
            {
                "owner_id": owner_id,
                "receipt_item_id": receipt_item_id,
                "category_id": cid,
            }
            for cid in category_ids
        ]
        stmt = insert(ReceiptItemCategoryLink).values(values)
        session.exec(stmt)

    session.commit()


def set_receipt_items_categories_by_name(
    session: Session,
    *,
    owner_id: uuid.UUID,
    item_name: str,
    category_ids: list[uuid.UUID],
) -> int:
    item_name = item_name.strip()
    if not item_name:
        raise ValueError("Item name is required")

    category_ids = list(dict.fromkeys(category_ids))
    if category_ids:
        rows = session.exec(
            select(ReceiptItemCategory.id).where(
                ReceiptItemCategory.owner_id == owner_id,
                ReceiptItemCategory.id.in_(category_ids),  # type: ignore
                ReceiptItemCategory.is_active.is_(True),  # type: ignore
            )
        ).all()
        found = set(rows)
        missing = [cid for cid in category_ids if cid not in found]
        if missing:
            raise ValueError(f"Some categories not found: {missing}")

    item_ids = session.exec(
        select(ReceiptItem.id)
        .join(Receipt, col(Receipt.id) == col(ReceiptItem.receipt_id))
        .where(
            col(Receipt.owner_id) == owner_id,
            func.lower(func.trim(col(ReceiptItem.name))) == item_name.lower(),
        )
    ).all()
    if not item_ids:
        return 0

    session.exec(
        delete(ReceiptItemCategoryLink).where(
            col(ReceiptItemCategoryLink.owner_id) == owner_id,
            col(ReceiptItemCategoryLink.receipt_item_id).in_(item_ids),  # type: ignore
        )
    )  # type: ignore

    if category_ids:
        values = [
            {
                "owner_id": owner_id,
                "receipt_item_id": item_id,
                "category_id": cid,
            }
            for item_id in item_ids
            for cid in category_ids
        ]
        stmt = insert(ReceiptItemCategoryLink).values(values)
        session.exec(stmt)

    session.commit()
    return len(item_ids)
