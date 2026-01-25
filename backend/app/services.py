from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, asc, desc, extract, func, select
from sqlalchemy.orm import Session

from . import models


def get_user_total_sum(db: Session, user_id: int):
    """Общая сумма трат пользователя за все время"""
    return db.execute(
        select(
            func.coalesce(func.sum(models.Receipt.total_sum), 0).label("total_sum"),
            func.coalesce(func.sum(models.Receipt.cash_total_sum), 0).label(
                "cash_total_sum"
            ),
            func.coalesce(func.sum(models.Receipt.ecash_total_sum), 0).label(
                "ecash_total_sum"
            ),
            func.count(models.Receipt.id).label("receipts_count"),
        ).where(models.Receipt.user_id == user_id)
    ).first()


def get_monthly_dynamics(db: Session, user_id: int, year: int = 2026):
    """Динамика трат по месяцам за конкретный год"""
    return db.execute(
        select(
            extract("month", models.Receipt.date_time).label("month"),
            func.coalesce(func.sum(models.Receipt.total_sum), 0).label("total_sum"),
            func.coalesce(func.sum(models.Receipt.cash_total_sum), 0).label(
                "cash_total_sum"
            ),
            func.coalesce(func.sum(models.Receipt.ecash_total_sum), 0).label(
                "ecash_total_sum"
            ),
            func.count(models.Receipt.id).label("receipts_count"),
        )
        .where(models.Receipt.user_id == user_id)
        .where(extract("year", models.Receipt.date_time) == year)
        .group_by("month")
        .order_by("month")
    ).all()


def get_top_products(db: Session, user_id: int, limit: int = 10):
    """Топ самых покупаемых товаров (по сумме затрат)"""
    return db.execute(
        select(
            models.ReceiptItem.name,
            func.sum(models.ReceiptItem.sum).label("total_sum"),
            func.sum(models.ReceiptItem.quantity).label("total_quantity"),
            models.ReceiptItem.measure,
        )
        .join(models.Receipt)
        .where(models.Receipt.user_id == user_id)
        .group_by(models.ReceiptItem.name, models.ReceiptItem.measure)
        .order_by(func.sum(models.ReceiptItem.sum).desc())
        .limit(limit)
    ).all()


# --- СТАТИСТИКА ПО МАГАЗИНАМ (Retail Name) ---
def get_spending_by_retail_shops(
    db: Session, user_id: int, sort_by: str = "total_amount", descending: bool = True
):
    """
    Возвращает статистику расходов пользователя в разрезе торговых точек.

    Функция агрегирует данные по чекам, группируя их по уникальным магазинам (ID + название).
    Позволяет получить общую сумму трат, количество визитов и средний чек для каждой точки.

    Args:
        db (Session): Сессия базы данных SQLAlchemy.
        user_id (int): Идентификатор пользователя, чьи траты нужно проанализировать.
        sort_by (str): Поле для сортировки. Доступные значения:
            - "id": Идентификатор магазина.
            - "retail_name": Торговое название (напр. "Пятерочка").
            - "legal_name": Юридическое название (напр. "ООО АГРОТОРГ").
            - "total_amount": Общая сумма всех трат (по умолчанию).
            - "receipts_count": Общее количество чеков.
            - "receipt_avg": Средний чек в данном магазине.
        descending (bool): Направление сортировки.
            True — от большего к меньшему (по умолчанию),
            False — от меньшего к большему.

    Returns:
        List[Row]: Список объектов Row (строк БД). Каждая строка содержит атрибуты:
            - id (int): ID магазина.
            - retail_name (str): Публичное название магазина.
            - legal_name (str): Официальное название организации.
            - total_amount (float): Сумма всех покупок.
            - receipts_count (int): Количество чеков.
            - receipt_avg (float): Средний чек.

    Example:
        >>> stats = get_spending_by_retail_shops(db, user_id=1, sort_by="receipt_avg")
        >>> for shop in stats:
        >>>     print(f"{shop.retail_name}: {shop.total_amount} руб. (avg: {shop.receipt_avg})")
    """
    # 1. Определяем базовый запрос
    stmt = (
        select(
            models.Shop.id.label("id"),
            models.Shop.retail_name.label("retail_name"),
            models.Shop.legal_name.label("legal_name"),
            models.Shop.inn.label("inn"),
            models.Shop.address.label("address"),
            models.Shop.category.label("category"),
            models.Shop.is_favorite.label("is_favorite"),
            models.Shop.notes.label("notes"),
            func.sum(models.Receipt.total_sum).label("total_amount"),
            func.count(models.Receipt.id).label("receipts_count"),
            func.avg(models.Receipt.total_sum).label("receipt_avg"),
        )
        .join(models.Receipt, models.Receipt.shop_id == models.Shop.id)
        .where(models.Receipt.user_id == user_id)
        .group_by(models.Shop.id, models.Shop.retail_name, models.Shop.legal_name)
    )

    # 2. Словарь доступных полей для сортировки (по их лейблам)
    # Используем stmt.selected_columns для доступа к колонкам по их именам
    sort_columns = {
        "id": stmt.selected_columns.id,
        "retail_name": stmt.selected_columns.retail_name,
        "legal_name": stmt.selected_columns.legal_name,
        "total_amount": stmt.selected_columns.total_amount,
        "receipts_count": stmt.selected_columns.receipts_count,
        "receipt_avg": stmt.selected_columns.receipt_avg,
    }

    # 3. Применяем сортировку
    target_column = sort_columns.get(sort_by, stmt.selected_columns.total_amount)
    order_func = desc if descending else asc

    stmt = stmt.order_by(order_func(target_column))

    return db.execute(stmt).all()


# --- ТОП ПРОДУКТОВ ЗА УКАЗАННЫЙ ПЕРИОД ---
def get_top_products_by_period(
    db: Session, user_id: int, months_back: int, limit: int = 10
):
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
            models.ReceiptItem.measure,
        )
        .join(models.Receipt)
        .where(
            and_(
                models.Receipt.user_id == user_id,
                models.Receipt.date_time >= start_date,
                models.Receipt.date_time <= end_date,
            )
        )
        .group_by(models.ReceiptItem.name, models.ReceiptItem.measure)
        .order_by(func.sum(models.ReceiptItem.sum).desc())
        .limit(limit)
    ).all()
