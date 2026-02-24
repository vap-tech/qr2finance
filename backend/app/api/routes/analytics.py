import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    DashboardPaymentSplit,
    DashboardResponse,
    DashboardTimeseriesPoint,
    DashboardTopShop,
    DashboardTotals,
    Receipt,
    ReceiptItem,
    ReceiptShort,
    ReceiptsShortPublic,
    Shop,
    ShopCategoryLink,
    ShopRead,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

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


def _receipt_filters(
    current_user: CurrentUser,
    date_from: date | None,
    date_to: date | None,
    shop_id: uuid.UUID | None,
    shop_category_id: uuid.UUID | None,
    cashier_id: uuid.UUID | None,
) -> list[Any]:
    filters: list[Any] = []

    if not current_user.is_superuser:
        filters.append(col(Receipt.owner_id) == current_user.id)

    if shop_id:
        filters.append(col(Receipt.shop_id) == shop_id)

    if shop_category_id:
        category_shop_ids = select(ShopCategoryLink.shop_id).where(
            col(ShopCategoryLink.category_id) == shop_category_id
        )
        if not current_user.is_superuser:
            category_shop_ids = category_shop_ids.where(
                col(ShopCategoryLink.owner_id) == current_user.id
            )
        filters.append(col(Receipt.shop_id).in_(category_shop_ids))  # type: ignore[arg-type]

    if cashier_id:
        filters.append(col(Receipt.cashier_id) == cashier_id)

    if date_from:
        dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        filters.append(col(Receipt.date_time) >= dt_from)

    if date_to:
        dt_to_exclusive = datetime.combine(
            date_to + timedelta(days=1),
            time.min,
            tzinfo=timezone.utc,
        )
        filters.append(col(Receipt.date_time) < dt_to_exclusive)

    return filters


def _format_day(value: Any) -> str:
    if isinstance(value, datetime):
        day = value.date()
    elif isinstance(value, date):
        day = value
    elif isinstance(value, str):
        day = date.fromisoformat(value)
    else:
        day = value
    return day.strftime("%d-%m-%Y")


@router.get("/dashboard", response_model=DashboardResponse)
def read_dashboard(
    session: SessionDep,
    current_user: CurrentUser,
    date_from: date | None = None,
    date_to: date | None = None,
    shop_id: uuid.UUID | None = None,
    shop_category_id: uuid.UUID | None = None,
    cashier_id: uuid.UUID | None = None,
    latest_limit: int = Query(default=10, ge=1, le=50),
) -> Any:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be <= date_to")

    filters = _receipt_filters(
        current_user,
        date_from,
        date_to,
        shop_id,
        shop_category_id,
        cashier_id,
    )

    totals_stmt = select(
        func.coalesce(func.sum(col(Receipt.total_sum)), 0),
        func.count(col(Receipt.id)),
        func.coalesce(func.count(func.distinct(col(Receipt.shop_id))), 0),
    ).where(*filters)
    total_sum, receipts_count, unique_shops = session.exec(totals_stmt).one()

    avg_receipt = float(total_sum) / receipts_count if receipts_count else 0.0
    totals = DashboardTotals(
        revenue=int(total_sum),
        receipts_count=int(receipts_count),
        avg_receipt=avg_receipt,
        unique_shops=int(unique_shops),
    )

    split_stmt = select(
        func.coalesce(func.sum(col(Receipt.cash_total_sum)), 0),
        func.coalesce(func.sum(col(Receipt.ecash_total_sum)), 0),
        func.coalesce(func.sum(col(Receipt.total_sum)), 0),
    ).where(*filters)
    cash_total, ecash_total, total_sum = session.exec(split_stmt).one()

    total_sum_int = int(total_sum)
    cash_percent = float(cash_total) / total_sum_int * 100 if total_sum_int else 0.0
    ecash_percent = float(ecash_total) / total_sum_int * 100 if total_sum_int else 0.0
    payment_split = DashboardPaymentSplit(
        cash_total_sum=int(cash_total),
        ecash_total_sum=int(ecash_total),
        total_sum=total_sum_int,
        cash_percent=cash_percent,
        ecash_percent=ecash_percent,
    )

    day_col = func.date(col(Receipt.date_time)).label("day")
    timeseries_stmt = (
        select(
            day_col,
            func.coalesce(func.sum(col(Receipt.total_sum)), 0).label("revenue"),
            func.count(col(Receipt.id)).label("receipts_count"),
        )
        .where(*filters)
        .group_by(day_col)
        .order_by(day_col)
    )
    timeseries_rows = session.exec(timeseries_stmt).all()
    timeseries: list[DashboardTimeseriesPoint] = []
    for day, revenue, count in timeseries_rows:
        avg = float(revenue) / count if count else 0.0
        timeseries.append(
            DashboardTimeseriesPoint(
                date=_format_day(day),
                revenue=int(revenue or 0),
                receipts_count=int(count or 0),
                avg_receipt=avg,
            )
        )

    top_shops_stmt = (
        select(  # pyright: ignore[reportCallIssue]
            col(Receipt.shop_id),
            func.coalesce(func.sum(col(Receipt.total_sum)), 0).label("total_sum"),
            func.count(col(Receipt.id)).label("receipts_count"),
            col(Shop.retail_name),
            col(Shop.address),
        )
        .join(Shop, col(Shop.id) == col(Receipt.shop_id), isouter=True)
        .where(*filters)
        .group_by(col(Receipt.shop_id), col(Shop.retail_name), col(Shop.address))
        .order_by(func.sum(col(Receipt.total_sum)).desc())
        .limit(5)
    )
    top_shops_rows = session.exec(top_shops_stmt).all()
    top_shops: list[DashboardTopShop] = []
    for shop_id_value, shop_sum, shop_count, retail_name, address in top_shops_rows:
        display = (retail_name or "").strip() or (address or "").strip() or None
        top_shops.append(
            DashboardTopShop(
                shop_id=shop_id_value,
                shop_display=display,
                shop_name=(retail_name or None),
                shop_address=(address or None),
                total_sum=int(shop_sum or 0),
                receipts_count=int(shop_count or 0),
            )
        )

    latest_stmt = (
        select(Receipt, func.count(col(ReceiptItem.id)), Shop)
        .join(
            ReceiptItem,
            col(ReceiptItem.receipt_id) == col(Receipt.id),
            isouter=True,
        )
        .join(Shop, col(Shop.id) == col(Receipt.shop_id), isouter=True)
        .where(*filters)
        .group_by(col(Receipt.id), col(Shop.id))
        .order_by(col(Receipt.date_time).desc())
        .limit(latest_limit)
    )

    latest_rows = session.exec(latest_stmt).all()
    latest_receipts_data: list[ReceiptShort] = []
    for receipt, items_count, shop in latest_rows:
        shop_read = ShopRead.model_validate(shop) if shop else None
        latest_receipts_data.append(
            ReceiptShort(
                id=receipt.id,
                date_time=receipt.date_time,
                total_sum=receipt.total_sum,
                cash_total_sum=receipt.cash_total_sum,
                ecash_total_sum=receipt.ecash_total_sum,
                items_count=int(items_count),
                shop_display=_build_shop_display(shop_read),
                shop=shop_read,
            )
        )

    latest_receipts = ReceiptsShortPublic(
        data=latest_receipts_data,
        count=len(latest_receipts_data),
    )

    return DashboardResponse(
        totals=totals,
        payment_split=payment_split,
        timeseries=timeseries,
        top_shops=top_shops,
        latest_receipts=latest_receipts,
    )
