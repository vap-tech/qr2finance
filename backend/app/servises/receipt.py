import uuid
from typing import cast

from sqlmodel import Session, col, func, select

from app.models import Receipt, ReceiptCreate, ReceiptItem, ReceiptWithItemsCreate


def _validate_receipt_identity_input(receipt_in: ReceiptCreate) -> None:
    if not receipt_in.fiscal_drive_number:
        raise ValueError("fiscal_drive_number is required")

    if not receipt_in.fiscal_document_number:
        raise ValueError("fiscal_document_number is required")
    if not receipt_in.fiscal_sign:
        raise ValueError("fiscal_sign is required")
    if not receipt_in.date_time:
        raise ValueError("date_time is required")
    if not receipt_in.total_sum:
        raise ValueError("total_sum is required")


def _find_receipt_by_identity(
    session: Session, *, receipt_in: ReceiptCreate
) -> Receipt | None:
    _validate_receipt_identity_input(receipt_in)

    return session.exec(
        select(Receipt).where(
            Receipt.fiscal_document_number == receipt_in.fiscal_document_number,
            Receipt.fiscal_drive_number == receipt_in.fiscal_drive_number,
            Receipt.fiscal_sign == receipt_in.fiscal_sign,
            Receipt.date_time == receipt_in.date_time,
            Receipt.total_sum == receipt_in.total_sum,
        )
    ).one_or_none()


def get_or_create_receipt(
    session: Session, *, owner_id: uuid.UUID, receipt_in: ReceiptCreate
) -> Receipt:
    """
    Return existing receipt by fiscal identity or create a new one without committing.

    Notes:
    - Identity key:
      (fiscal_document_number, fiscal_drive_number, fiscal_sign, date_time, total_sum)
    - Service always receives `owner_id` separately from payload.
    """
    existing = _find_receipt_by_identity(session, receipt_in=receipt_in)
    if existing is not None:
        if existing.owner_id != owner_id:
            raise ValueError("Receipt already exists for another owner")
        return existing

    payload = receipt_in.model_dump()
    receipt = Receipt(**payload, owner_id=owner_id)
    session.add(receipt)
    session.flush()
    return receipt


def create_receipt_with_items(
    session: Session, *, owner_id: uuid.UUID, payload: ReceiptWithItemsCreate
) -> Receipt:
    """
    Create receipt with nested items in one operation.

    If receipt already exists by fiscal identity, returns the existing receipt
    without creating additional items.
    """
    receipt_in = payload.receipt
    existing = _find_receipt_by_identity(session, receipt_in=receipt_in)
    if existing is not None:
        if existing.owner_id != owner_id:
            raise ValueError("Receipt already exists for another owner")
        return existing

    receipt = get_or_create_receipt(session, owner_id=owner_id, receipt_in=receipt_in)

    for item_in in payload.items:
        item = ReceiptItem(**item_in.model_dump(), receipt_id=receipt.id)
        session.add(item)

    session.flush()
    return receipt


def recalculate_receipt_payment_totals(session: Session, *, receipt: Receipt) -> None:
    """
    Recalculate receipt totals based on current item sums.

    Keeps payment type semantics:
    - cash-only stays cash-only
    - card-only stays card-only
    - mixed stays mixed (cash share preserved, card gets remainder)
    - unknown/zero payments fallback to card-only
    """
    items_total = cast(
        int,
        session.exec(
            select(func.coalesce(func.sum(col(ReceiptItem.sum)), 0)).where(
                col(ReceiptItem.receipt_id) == receipt.id
            )
        ).one(),
    )

    previous_total = receipt.total_sum
    previous_cash = receipt.cash_total_sum
    previous_ecash = receipt.ecash_total_sum

    if previous_cash > 0 and previous_ecash <= 0:
        receipt.cash_total_sum = items_total
        receipt.ecash_total_sum = 0
    elif previous_ecash > 0 and previous_cash <= 0:
        receipt.cash_total_sum = 0
        receipt.ecash_total_sum = items_total
    elif previous_cash > 0 and previous_ecash > 0 and previous_total > 0:
        cash_part = (items_total * previous_cash) // previous_total
        receipt.cash_total_sum = cash_part
        receipt.ecash_total_sum = items_total - cash_part
    else:
        receipt.cash_total_sum = 0
        receipt.ecash_total_sum = items_total

    receipt.total_sum = items_total
    session.add(receipt)
