from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from decimal import Decimal
from . import models, schemas
from .auth import get_password_hash


# User CRUD
def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        password_hash=hashed_password,
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


# Receipt CRUD
def create_receipt(db: Session, receipt: schemas.ReceiptCreate, user_id: int):
    # Проверка дубликатов с учетом разных форматов
    existing = db.query(models.Receipt).filter(
        models.Receipt.user_id == user_id,
        models.Receipt.fiscal_drive_number == receipt.fiscal_drive_number,
        models.Receipt.fiscal_document_number == receipt.fiscal_document_number,
        models.Receipt.fiscal_sign == receipt.fiscal_sign
    ).first()

    if existing:
        # Если чек уже существует, но у него нет товаров - добавляем их
        if not existing.items:
            for item in receipt.items:
                db_item = models.ReceiptItem(
                    **item.dict(exclude_unset=True),
                    receipt_id=existing.receipt_id
                )
                db.add(db_item)
            db.commit()
            db.refresh(existing)
        return existing

    db_receipt = models.Receipt(
        **receipt.dict(exclude={"items"}, exclude_unset=True),
        user_id=user_id
    )
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)

    # Добавляем товары с обработкой ошибок
    successful_items = 0
    for item in receipt.items:
        try:
            db_item = models.ReceiptItem(
                **item.dict(exclude_unset=True),
                receipt_id=db_receipt.receipt_id
            )
            db.add(db_item)
            successful_items += 1
        except Exception as e:
            print(f"Error saving item {item.name}: {str(e)}")
            continue

    db.commit()
    db.refresh(db_receipt)

    if successful_items < len(receipt.items):
        print(f"Warning: Saved {successful_items} out of {len(receipt.items)} items")

    return db_receipt


def get_user_receipts(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Receipt) \
        .filter(models.Receipt.user_id == user_id) \
        .order_by(models.Receipt.date_time.desc()) \
        .offset(skip).limit(limit).all()


# Analytics
def get_monthly_stats(db: Session, user_id: int, start_date: datetime = None, end_date: datetime = None):
    query = db.query(
        func.date_trunc('month', models.Receipt.date_time).label('month'),
        func.count(models.Receipt.receipt_id).label('receipts_count'),
        func.sum(models.Receipt.total_sum).label('total_sum'),
        func.sum(models.Receipt.cash_total_sum).label('cash_sum'),
        func.sum(models.Receipt.ecash_total_sum).label('ecash_sum')
    ).filter(models.Receipt.user_id == user_id)

    if start_date:
        query = query.filter(models.Receipt.date_time >= start_date)
    if end_date:
        query = query.filter(models.Receipt.date_time <= end_date)

    results = query.group_by(func.date_trunc('month', models.Receipt.date_time)) \
        .order_by(func.date_trunc('month', models.Receipt.date_time).desc()).all()

    return [
        schemas.MonthlyStats(
            month=row.month.strftime('%Y-%m'),
            receipts_count=row.receipts_count,
            total_sum_rub=Decimal(row.total_sum or 0),
            cash_sum_rub=Decimal(row.cash_sum or 0),
            ecash_sum_rub=Decimal(row.ecash_sum or 0)
        )
        for row in results
    ]


def get_top_products(db: Session, user_id: int, limit: int = 10):
    results = db.query(
        models.ReceiptItem.name,
        func.sum(models.ReceiptItem.quantity).label('total_quantity'),
        func.sum(models.ReceiptItem.sum).label('total_sum'),
        func.count(func.distinct(models.ReceiptItem.receipt_id)).label('receipts_count')
    ).join(
        models.Receipt, models.ReceiptItem.receipt_id == models.Receipt.receipt_id
    ).filter(
        models.Receipt.user_id == user_id
    ).group_by(
        models.ReceiptItem.name
    ).order_by(
        func.sum(models.ReceiptItem.sum).desc()
    ).limit(limit).all()

    return [
        schemas.TopProducts(
            name=row.name,
            total_quantity=Decimal(row.total_quantity or 0),
            total_sum_rub=Decimal(row.total_sum or 0),
            receipts_count=row.receipts_count
        )
        for row in results
    ]


def get_store_stats(db: Session, user_id: int):
    results = db.query(
        models.Receipt.retail_place,
        func.count(models.Receipt.receipt_id).label('receipts_count'),
        func.sum(models.Receipt.total_sum).label('total_sum'),
        func.avg(models.Receipt.total_sum).label('avg_sum'),
        func.min(models.Receipt.date_time).label('first_purchase'),
        func.max(models.Receipt.date_time).label('last_purchase')
    ).filter(
        models.Receipt.user_id == user_id,
        models.Receipt.retail_place.isnot(None)
    ).group_by(
        models.Receipt.retail_place
    ).order_by(
        func.sum(models.Receipt.total_sum).desc()
    ).all()

    return [
        schemas.StoreStats(
            retail_place=row.retail_place,
            receipts_count=row.receipts_count,
            total_sum_rub=Decimal(row.total_sum or 0),
            avg_receipt_sum_rub=Decimal(row.avg_sum or 0),
            first_purchase=row.first_purchase,
            last_purchase=row.last_purchase
        )
        for row in results
    ]