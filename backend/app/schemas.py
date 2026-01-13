from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(UserBase):
    user_id: int
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class ReceiptItemBase(BaseModel):
    name: str
    price: Decimal
    quantity: Decimal
    sum: Decimal
    nds: Optional[int] = None
    product_type: Optional[int] = None
    payment_type: int = 4
    gtin: Optional[str] = None
    product_id_type: Optional[int] = None
    serial_number: Optional[str] = None
    raw_product_code: Optional[str] = None

    @field_validator('gtin', mode='before')
    def convert_gtin_to_string(cls, v: Any) -> str:
        """Convert GTIN to string if it's a number"""
        if v is None:
            return ''
        # Если приходит число - конвертируем в строку
        if isinstance(v, (int, float)):
            # Убираем .0 у float и конвертируем в int
            v_int = int(v) if isinstance(v, float) else v
            return str(v_int)
        # Если уже строка - возвращаем как есть
        elif isinstance(v, str):
            return v
        # Для любых других типов конвертируем в строку
        return str(v)

    @field_validator('price', 'sum', mode='before')
    def convert_kopecks_to_rubles(cls, v):
        """Convert kopecks to rubles"""
        if v is None:
            return None
        # Если цена в копейках (как в оригинальном JSON)
        if isinstance(v, (int, float)) and v > 1000:  # Если больше 10 рублей в копейках
            return Decimal(v) / 100
        return Decimal(v) if v else Decimal(0)


class ReceiptItemCreate(ReceiptItemBase):
    pass


class ReceiptItem(ReceiptItemBase):
    item_id: int
    receipt_id: int

    class Config:
        from_attributes = True


class ReceiptBase(BaseModel):
    fiscal_drive_number: str
    fiscal_document_number: int
    fiscal_sign: int
    date_time: datetime
    total_sum: Decimal
    cash_total_sum: Decimal = 0
    ecash_total_sum: Decimal = 0
    credit_sum: Decimal = 0
    prepaid_sum: Decimal = 0
    provision_sum: Decimal = 0
    retail_place: Optional[str] = None
    retail_place_address: Optional[str] = None
    operator_name: Optional[str] = None
    operator_inn: Optional[str] = None
    shift_number: Optional[int] = None
    kkt_reg_id: Optional[str] = None
    fns_url: Optional[str] = None
    taxation_type: Optional[int] = None
    applied_taxation_type: Optional[int] = None
    nds10: Decimal = 0
    nds18: Decimal = 0
    user_org_name: Optional[str] = None
    user_org_inn: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None


class ReceiptCreate(ReceiptBase):
    items: List[ReceiptItemCreate]
    store_id: Optional[int] = None

    @field_validator(
        'total_sum',
        'cash_total_sum',
        'ecash_total_sum',
        'credit_sum',
        'prepaid_sum',
        'provision_sum',
        'nds10',
        'nds18',
        mode='before')
    def convert_amounts_to_rubles(cls, v):
        """Convert all amounts from kopecks to rubles"""
        if v is None:
            return Decimal(0)
        # Если сумма в копейках (обычно большие числа)
        if isinstance(v, (int, float)):
            # В российских чеках суммы обычно в копейках (9999 = 99.99 руб)
            return Decimal(v) / 100
        return Decimal(v)


class Receipt(ReceiptBase):
    receipt_id: int
    user_id: int
    created_at: datetime
    items: List[ReceiptItem] = []

    class Config:
        from_attributes = True


class AnalyticsRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    group_by: str = "month"  # month, week, day, year


class MonthlyStats(BaseModel):
    month: str
    receipts_count: int
    total_sum_rub: Decimal
    cash_sum_rub: Decimal
    ecash_sum_rub: Decimal


class TopProducts(BaseModel):
    name: str
    total_quantity: Decimal
    total_sum_rub: Decimal
    receipts_count: int


class StoreStats(BaseModel):
    retail_place: str
    receipts_count: int
    total_sum_rub: Decimal
    avg_receipt_sum_rub: Decimal
    first_purchase: datetime
    last_purchase: datetime


class StoreBase(BaseModel):
    name: str
    chain_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    is_favorite: bool = False
    category: Optional[str] = None
    notes: Optional[str] = None


class StoreCreate(StoreBase):
    pass


class StoreUpdate(StoreBase):
    name: Optional[str] = None


class Store(StoreBase):
    store_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    receipts_count: Optional[int] = None  # Для статистики
    total_spent: Optional[Decimal] = None  # Для статистики

    class Config:
        from_attributes = True


class StorePatternBase(BaseModel):
    pattern_type: str  # 'name', 'address', 'both'
    pattern_value: str
    store_id: int
    is_regex: bool = False
    priority: int = 10


class StorePatternCreate(StorePatternBase):
    pass


class StorePattern(StorePatternBase):
    pattern_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True