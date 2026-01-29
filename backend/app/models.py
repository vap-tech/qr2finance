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
    raw_backup: Mapped["ReceiptRawBackup"] = relationship(
        "ReceiptRawBackup",
        back_populates="receipt",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",  # или "joined" для всегда подгружаемого бэкапа
    )


class ReceiptRawBackup(Base):
    """Сырые JSON-данные чека для бэкапа и будущих расширений"""

    __tablename__ = "receipt_raw_backups"

    id: Mapped[int] = mapped_column(primary_key=True)
    raw_data: Mapped[dict] = mapped_column(
        JSONB, nullable=False, comment="Полные сырые данные чека в оригинальном формате"
    )
    source_format: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="fiscal",
        comment="Формат данных: fiscal, ofd, retail, etc.",
    )
    source_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        comment="SHA256 хэш сырых данных для предотвращения дубликатов",
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("receipts.id"),
        unique=True,  # Один чек - один бэкап
        nullable=False,
        comment="Ссылка на обработанный чек в основной таблице",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="Время создания записи в бэкапе",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
        comment="Время последнего обновления (если данные менялись)",
    )

    # Признаки обработки
    is_processed: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="Данные обработаны в основную таблицу"
    )
    processing_version: Mapped[int] = mapped_column(
        Integer, default=1, comment="Версия обработчика, который создал запись"
    )
    has_errors: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Были ли ошибки при обработке"
    )
    error_details: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, comment="Детали ошибок обработки"
    )

    # Опциональные метаданные для быстрого поиска
    metadata_json: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Извлеченные метаданные для индексации (дата, сумма, ФН и т.д.)",
    )

    # Связи
    user: Mapped["User"] = relationship("User", lazy="selectin")
    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="raw_backup")

    def __init__(self, **kwargs):
        # Автоматически вычисляем хэш если переданы raw_data
        if "raw_data" in kwargs and "source_hash" not in kwargs:
            import hashlib
            import json

            raw_str = json.dumps(kwargs["raw_data"], sort_keys=True, ensure_ascii=False)
            kwargs["source_hash"] = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
        super().__init__(**kwargs)


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
