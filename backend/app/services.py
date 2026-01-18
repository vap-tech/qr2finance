from sqlalchemy.orm import Session
from sqlalchemy import select, func, extract, and_
from datetime import date
from dateutil.relativedelta import relativedelta
from . import models

def get_user_total_spending(db: Session, user_id: int):
    """Общая сумма трат пользователя за все время"""
    return db.execute(
        select(func.sum(models.Receipt.total_sum))
        .where(models.Receipt.user_id == user_id)
    ).scalar() or 0

def get_monthly_dynamics(db: Session, user_id: int, year: int = 2026):
    """Динамика трат по месяцам за конкретный год"""
    return db.execute(
        select(
            extract('month', models.Receipt.date_time).label('month'),
            func.sum(models.Receipt.total_sum).label('sum')
        )
        .where(models.Receipt.user_id == user_id)
        .where(extract('year', models.Receipt.date_time) == year)
        .group_by('month')
        .order_by('month')
    ).all()

def get_top_products(db: Session, user_id: int, limit: int = 10):
    """Топ самых покупаемых товаров (по сумме затрат)"""
    return db.execute(
        select(
            models.ReceiptItem.name,
            func.sum(models.ReceiptItem.sum).label("total_sum"),
            func.sum(models.ReceiptItem.quantity).label("total_quantity"),
            models.ReceiptItem.measure
        )
        .join(models.Receipt)
        .where(models.Receipt.user_id == user_id)
        .group_by(models.ReceiptItem.name, models.ReceiptItem.measure)
        .order_by(func.sum(models.ReceiptItem.sum).desc())
        .limit(limit)
    ).all()

# --- СТАТИСТИКА ПО МАГАЗИНАМ (Retail Name) ---
def get_spending_by_retail_shops(db: Session, user_id: int):
    """
    Статистика трат в разрезе конкретных магазинов (retail_name, например: S760 10815-Пятерочка)
    """
    return db.execute(
        select(
            models.Shop.retail_name,
            func.sum(models.Receipt.total_sum).label("total_amount"),
            func.count(models.Receipt.id).label("receipts_count")
        )
        .join(models.Receipt, models.Receipt.shop_id == models.Shop.id)
        .where(models.Receipt.user_id == user_id)
        .group_by(models.Shop.retail_name)
        .order_by(func.sum(models.Receipt.total_sum).desc())
    ).all()

# --- ТОП ПРОДУКТОВ ЗА УКАЗАННЫЙ ПЕРИОД ---
def get_top_products_by_period(db: Session, user_id: int, months_back: int, limit: int = 10):
    """
    Топ самых покупаемых товаров по затратам за последние N месяцев.
    """
    # Устанавливаем дату начала периода (например, 3 месяца назад от сегодня)
    end_date = date.today()
    # requires 'python-dateutil' library: pip install python-dateutil
    start_date = end_date - relativedelta(months=months_back)

    return db.execute(
        select(
            models.ReceiptItem.name,
            func.sum(models.ReceiptItem.sum).label("total_sum"),
            func.sum(models.ReceiptItem.quantity).label("total_quantity"),
            models.ReceiptItem.measure
        )
        .join(models.Receipt)
        .where(
            and_(
                models.Receipt.user_id == user_id,
                models.Receipt.date_time >= start_date,
                models.Receipt.date_time <= end_date
            )
        )
        .group_by(models.ReceiptItem.name, models.ReceiptItem.measure)
        .order_by(func.sum(models.ReceiptItem.sum).desc())
        .limit(limit)
    ).all()
