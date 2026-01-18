from datetime import datetime
from typing import List, Optional
from sqlalchemy import ForeignKey, String, BigInteger, DateTime, Integer, Float, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

class User(Base):
    """Пользователь системы (владелец чеков)"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    receipts: Mapped[List["Receipt"]] = relationship(back_populates="user")


class Shop(Base):
    """Магазин и Юр.лицо (владелец сети)"""
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)
    legal_name: Mapped[str] = mapped_column(String(255))  # Напр: ООО "Агроторг"
    inn: Mapped[str] = mapped_column(String(12), index=True)
    retail_name: Mapped[Optional[str]] = mapped_column(String(255))  # Напр: Пятерочка
    address: Mapped[Optional[str]] = mapped_column(String(500))

    # Новые поля для совместимости с фронтендом
    category: Mapped[Optional[str]] = mapped_column(String(100))  # Супермаркет
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000))

    receipts: Mapped[List["Receipt"]] = relationship(back_populates="shop")


class Cashier(Base):
    """Информация о кассире"""
    __tablename__ = "cashiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))  # ФИО
    inn: Mapped[Optional[str]] = mapped_column(String(12))  # ИНН кассира

    receipts: Mapped[List["Receipt"]] = relationship(back_populates="cashier")


class Receipt(Base):
    """Заголовок чека"""
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True)
    date_time: Mapped[datetime] = mapped_column(DateTime)
    total_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках

    # Реквизиты ФНС
    fiscal_drive_number: Mapped[str] = mapped_column(String(20))
    fiscal_document_number: Mapped[int] = mapped_column(Integer)
    fiscal_sign: Mapped[str] = mapped_column(String(20))
    shift_number: Mapped[Optional[int]] = mapped_column(Integer)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"))
    cashier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cashiers.id"))

    user: Mapped["User"] = relationship(back_populates="receipts")
    shop: Mapped["Shop"] = relationship(back_populates="receipts")
    cashier: Mapped["Cashier"] = relationship(back_populates="receipts")
    items: Mapped[List["ReceiptItem"]] = relationship(back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    """Позиция товара в чеке"""
    __tablename__ = "receipt_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.id"))

    name: Mapped[str] = mapped_column(String(500))
    price: Mapped[int] = mapped_column(BigInteger)
    quantity: Mapped[float] = mapped_column(Float)
    sum: Mapped[int] = mapped_column(BigInteger)

    # --- Единицы измерения ---
    # Сюда записываем "шт", "кг", "л" или "уп"
    # Позволяет отличать весовой товар от штучного для разной логики обработки
    measure: Mapped[Optional[str]] = mapped_column(String(20), default="шт")

    # Технические поля из JSON
    product_type: Mapped[Optional[int]] = mapped_column(Integer)  # Напр. 1 - товар, 33 - маркированный
    gtin: Mapped[Optional[str]] = mapped_column(String(20))
    raw_product_code: Mapped[Optional[str]] = mapped_column(String(500))

    receipt: Mapped["Receipt"] = relationship(back_populates="items")
