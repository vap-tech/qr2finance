from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from . import models, schemas
from .auth import get_password_hash


# --- USER CRUD ---
def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)

    # Извлекаем все данные кроме пароля в виде обычного словаря
    user_data = user.model_dump(exclude={"password"})

    db_user = models.User(
        **user_data,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str):
    # В SQLAlchemy 2.0 рекомендуется использовать select()
    return db.execute(
        select(models.User).where(models.User.email == email)
    ).scalar_one_or_none()


# --- SHOP CRUD (с логикой уникальности по ИНН) ---
def get_or_create_shop(db: Session, shop_data: schemas.ShopCreate):
    shop = db.execute(
        select(models.Shop).where(models.Shop.inn == shop_data.inn)
    ).scalar_one_or_none()

    if not shop:
        shop = models.Shop(**shop_data.model_dump())
        db.add(shop)
        db.flush()  # Получаем ID, но не фиксируем транзакцию окончательно
    return shop


# --- CASHIER CRUD (с логикой уникальности по ИНН/Имени) ---
def get_or_create_cashier(db: Session, cashier_data: schemas.CashierCreate):
    if not cashier_data.name and not cashier_data.inn:
        return None

    query = select(models.Cashier)
    if cashier_data.inn:
        query = query.where(models.Cashier.inn == cashier_data.inn)
    else:
        query = query.where(models.Cashier.name == cashier_data.name)

    cashier = db.execute(query).scalar_one_or_none()

    if not cashier:
        cashier = models.Cashier(**cashier_data.model_dump())
        db.add(cashier)
        db.flush()
    return cashier


# --- RECEIPT CRUD (ГЛАВНАЯ ЛОГИКА) ---
def create_receipt_full(db: Session, receipt_data: dict, user_id: int):
    """
    Принимает сырой словарь (parsed JSON) или схему и сохраняет все связи.
    """
    # 1. Проверяем, не существует ли уже такой чек (по external_id)
    existing_receipt = db.execute(
        select(models.Receipt).where(models.Receipt.external_id == receipt_data['_id'])
    ).scalar_one_or_none()

    if existing_receipt:
        return existing_receipt

    ticket = receipt_data['ticket']['document']['receipt']

    # 2. Обрабатываем магазин
    shop = get_or_create_shop(db, schemas.ShopCreate(
        legal_name=ticket['user'],
        inn=ticket['userInn'].strip(),
        retail_name=ticket.get('retailPlace'),
        address=ticket.get('retailPlaceAddress')
    ))

    # 3. Обрабатываем кассира
    cashier = get_or_create_cashier(db, schemas.CashierCreate(
        name=ticket.get('operator'),
        inn=ticket.get('operatorInn')
    ))

    # 4. Создаем чек
    db_receipt = models.Receipt(
        external_id=receipt_data['_id'],
        date_time=datetime.fromisoformat(ticket['dateTime']),
        total_sum=ticket['totalSum'],
        fiscal_drive_number=ticket['fiscalDriveNumber'],
        fiscal_document_number=ticket['fiscalDocumentNumber'],
        fiscal_sign=str(ticket['fiscalSign']),
        shift_number=ticket.get('shiftNumber'),
        user_id=user_id,
        shop_id=shop.id,
        cashier_id=cashier.id if cashier else None
    )
    db.add(db_receipt)
    db.flush()

    # 5. Добавляем позиции (Items)
    for item in ticket['items']:
        # Логика определения единицы измерения (кг vs шт)
        quantity = item['quantity']
        measure = "кг" if (not float(quantity).is_integer() or "кг" in item['name'].lower()) else "шт"

        db_item = models.ReceiptItem(
            receipt_id=db_receipt.id,
            name=item['name'],
            price=item['price'],
            quantity=quantity,
            sum=item['sum'],
            measure=measure,
            product_type=item.get('productType'),
            gtin=item.get('productCodeData', {}).get('gtin'),
            raw_product_code=item.get('productCodeData', {}).get('rawProductCode')
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_receipt)
    return db_receipt


def get_user_receipts(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.execute(
        select(models.Receipt)
        .where(models.Receipt.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.Receipt.date_time.desc())
    ).scalars().all()
