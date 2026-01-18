from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# --- ПОЗИЦИЯ ЧЕКА ---
class ReceiptItemBase(BaseModel):
    name: str
    price: int
    quantity: float
    sum: int
    measure: Optional[str] = "шт"
    gtin: Optional[str] = None
    raw_product_code: Optional[str] = None
    product_type: Optional[int] = None

class ReceiptItemCreate(ReceiptItemBase):
    pass

class ReceiptItem(ReceiptItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_id: int

# --- КАССИР ---
class CashierBase(BaseModel):
    name: Optional[str] = None
    inn: Optional[str] = None

class CashierCreate(CashierBase):
    pass

class Cashier(CashierBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

# --- МАГАЗИН ---
class ShopBase(BaseModel):
    legal_name: str
    inn: str
    retail_name: Optional[str] = None
    address: Optional[str] = None

class ShopCreate(ShopBase):
    pass

class Shop(BaseModel):
    # Позволяет Pydantic работать с объектами SQLAlchemy
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    # Алиасы: при чтении из БД берется 'id', но в JSON превращается в 'store_id'
    id: int
    retail_name: str
    legal_name: str

    inn: str
    address: Optional[str] = None
    category: Optional[str] = None
    is_favorite: bool = False
    notes: Optional[str] = None


class StoreStat(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    retail_name: str
    legal_name: str
    total_amount: int
    receipts_count: int
    receipt_avg: Optional[float] = 0


# --- ЧЕК ---
class ReceiptBase(BaseModel):
    external_id: str
    date_time: datetime
    total_sum: int
    fiscal_drive_number: str
    fiscal_document_number: int
    fiscal_sign: str
    shift_number: Optional[int] = None

class ReceiptCreate(ReceiptBase):
    shop_id: int
    cashier_id: Optional[int] = None
    user_id: int
    items: List[ReceiptItemCreate]

class Receipt(ReceiptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    shop: Shop
    cashier: Optional[Cashier]
    items: List[ReceiptItem]

# --- ПОЛЬЗОВАТЕЛЬ ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Пароль должен быть не менее 8 символов")

class User(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime

# --- СХЕМЫ ДЛЯ ОТВЕТОВ С ВКЛАДЫВАЕМЫМИ ДАННЫМИ ---
class UserWithReceipts(User):
    receipts: List[Receipt] = []

# --- СХЕМЫ ДЛЯ АУТЕНТИФИКАЦИИ ---
class UserLogin(BaseModel):
    """Схема для входа пользователя"""
    email: EmailStr
    password: str

class Token(BaseModel):
    """Схема ответа при успешном логине"""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Данные, хранящиеся внутри токена (payload)"""
    user_id: Optional[str] = None


# Аналитика
class MonthlyDynamics(BaseModel):
    month: int
    receipts_count: int
    sum: float

class ProductTop(BaseModel):
    name: str
    total_sum: float
    total_quantity: float
    measure: str
