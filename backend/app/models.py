import hashlib
import json
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    """Пользователь системы (владелец чеков)"""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    telegram_id: Mapped[str] = mapped_column(String(100), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
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

    # id'шники и время создания самого чека
    id: Mapped[int] = mapped_column(primary_key=True)
    external_id: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # похоже что дата/время оплаты, но нужно проверить
    date_time: Mapped[datetime] = mapped_column(DateTime)

    # суммы (похоже наличка/кредитка/дебеткарт и общая сума по способам)
    # code - выглядит как код способа расчета
    code: Mapped[int] = mapped_column(Integer)
    cash_total_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках
    credit_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках
    ecash_total_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках
    total_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках
    prepaid_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках
    provision_sum: Mapped[int] = mapped_column(BigInteger)  # В копейках

    # Реквизиты ФНС
    fiscal_document_format_ver: Mapped[int] = mapped_column(Integer)
    fiscal_drive_number: Mapped[str] = mapped_column(String(20))
    fiscal_document_number: Mapped[int] = mapped_column(Integer)
    fiscal_sign: Mapped[int] = mapped_column(BigInteger)
    shift_number: Mapped[Optional[int]] = mapped_column(Integer)
    kkt_reg_id: Mapped[str] = mapped_column(String(20))
    nds_10: Mapped[int] = mapped_column(BigInteger, nullable=True)
    nds_18: Mapped[int] = mapped_column(BigInteger, nullable=True)
    operation_type: Mapped[int] = mapped_column(Integer)
    request_number: Mapped[int] = mapped_column(Integer)
    taxation_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    applied_taxation_type: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # пользователь магазин и кассир
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id"))
    cashier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("cashiers.id"))

    user: Mapped["User"] = relationship(back_populates="receipts")
    shop: Mapped["Shop"] = relationship(back_populates="receipts")
    cashier: Mapped["Cashier"] = relationship(back_populates="receipts")
    items: Mapped[List["ReceiptItem"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan"
    )
    raw_backup: Mapped[Optional["ReceiptRawBackup"]] = relationship(
        "ReceiptRawBackup",
        back_populates="receipt",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",  # Не грузим автоматически
    )


class ReceiptRawBackup(Base):
    """Сырые данные чеков с контролем целостности через хэш"""

    __tablename__ = "receipt_raw_backups"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Сырые данные
    raw_json: Mapped[dict] = mapped_column(
        JSONB, nullable=False, comment="Сырые JSON данные в оригинальном формате"
    )

    # Хэш SHA256 для контроля целостности и поиска дубликатов
    source_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,  # Гарантируем уникальность чеков
        nullable=False,
        index=True,  # Индекс для быстрого поиска
        comment="SHA256 хэш от json.dumps(raw_json, sort_keys=True)",
    )

    # Тип источника
    source_type: Mapped[str] = mapped_column(
        String(50),
        default="fiscal_mobile",
        nullable=False,
        comment="fiscal_mobile - приложение ФНС, fiscal_direct - прямые фискальные данные, etc.",
    )

    # Детали импорта
    import_method: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Как попали данные: mobile_scan, api, file_upload, manual",
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("receipts.id"),
        unique=True,  # Один чек - один бэкап
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Для отладки
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Метаданные: размер данных, кол-во товаров, версия формата",
    )

    # Связи
    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="raw_backup")
    user: Mapped["User"] = relationship("User")

    def __init__(self, **kwargs):
        # Автоматически вычисляем хэш при создании
        if "raw_json" in kwargs and "source_hash" not in kwargs:
            kwargs["source_hash"] = self._compute_hash(kwargs["raw_json"])

        # Автоматически заполняем метаданные
        if "raw_json" in kwargs and "metadata_json" not in kwargs:
            kwargs["metadata_json"] = self._extract_metadata(kwargs["raw_json"])

        super().__init__(**kwargs)

    @staticmethod
    def _compute_hash(data: dict) -> str:
        """Вычисляет SHA256 хэш от JSON"""
        # sort_keys=True для детерминированного хэша
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(json_str.encode("utf-8")).hexdigest()

    @staticmethod
    def _extract_metadata(data: dict) -> dict:
        """Извлекает метаданные из сырых данных"""
        receipt = data.get("ticket", {}).get("document", {}).get("receipt", {})
        items = receipt.get("items", [])

        return {
            "data_size_bytes": len(json.dumps(data).encode("utf-8")),
            "items_count": len(items),
            "total_sum": receipt.get("totalSum"),
            "has_products_with_codes": any("productCodeData" in item for item in items),
            "timestamp": data.get("createdAt"),
        }

    def verify_integrity(self) -> bool:
        """Проверяет целостность данных"""
        current_hash = self._compute_hash(self.raw_json)
        return current_hash == self.source_hash

    def update_hash(self) -> None:
        """Пересчитывает хэш (если данные изменились)"""
        self.source_hash = self._compute_hash(self.raw_json)


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
    product_type: Mapped[Optional[int]] = mapped_column(
        Integer
    )  # Напр. 1 - товар, 33 - маркированный
    gtin: Mapped[Optional[str]] = mapped_column(String(20))
    raw_product_code: Mapped[Optional[str]] = mapped_column(String(500))

    receipt: Mapped["Receipt"] = relationship(back_populates="items")
