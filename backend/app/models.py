import hashlib
import json
import uuid
from datetime import datetime, timezone
from enum import Enum

from pydantic import EmailStr
from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(timezone.utc)


# Shared properties
class UserBase(SQLModel):
    """Shared user fields."""

    email: EmailStr = Field(unique=True, index=True, max_length=255)
    telegram_id: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    """User creation payload with password."""

    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    """User self-registration payload."""

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    """User update payload (all fields optional)."""

    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    """User self-update payload."""

    full_name: str | None = Field(default=None, max_length=255)
    telegram_id: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    """Password change payload."""

    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    """User database model."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    receipts: list["Receipt"] = Relationship(back_populates="owner")
    receipt_raw_backup: list["ReceiptRawBackup"] = Relationship(back_populates="owner")


# Properties to return via API, id is always required
class UserPublic(UserBase):
    """Public user representation."""

    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    """Paginated list of public users."""

    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    """Shared item fields."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    """Item creation payload."""

    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    """Item update payload (fields optional)."""

    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    """Item database model."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    """Public item representation."""

    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    """Paginated list of public items."""

    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    """Generic message response."""

    message: str


# Health check payload
class HealthCheck(SQLModel):
    """Health check response."""

    app: bool
    database: bool


# JSON payload containing access token
class Token(SQLModel):
    """Access token payload."""

    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    """JWT token contents."""

    sub: str | None = None


class NewPassword(SQLModel):
    """Password reset payload."""

    token: str
    new_password: str = Field(min_length=8, max_length=128)


class CashierBase(SQLModel):
    name: str = Field(sa_type=String)
    inn: str = Field(sa_type=String)


class CashierCreate(CashierBase):
    pass


class CashierUpdate(CashierBase):
    pass


class Cashier(CashierBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    is_active: bool = Field(default=True)
    receipts: list["Receipt"] = Relationship(back_populates="cashier")


class CashierPublic(CashierBase):
    id: uuid.UUID


class CashiersPublic(SQLModel):
    """Paginated list of public cashiers."""

    data: list[CashierPublic]
    count: int


class ShopOwnerBase(SQLModel):
    name: str = Field(sa_type=String, index=True)
    inn: str = Field(sa_type=String, unique=True)


class ShopOwnerCreate(ShopOwnerBase):
    pass


class ShopOwnerUpdate(ShopOwnerBase):
    pass


class ShopOwner(ShopOwnerBase, table=True):
    __tablename__ = "shop_owners"  # type: ignore
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    is_active: bool = Field(default=True)
    shops: list["Shop"] = Relationship(back_populates="shop_owner")


class ShopOwnerPublic(ShopOwnerBase):
    id: uuid.UUID


class ShopOwnersPublic(SQLModel):
    """Paginated list of public shop owners."""

    data: list[ShopOwnerPublic]
    count: int


# --- Shop ---
class ShopCategoryLink(SQLModel, table=True):
    """
    Link-таблица M:N. Primary key на (shop_id, category_id) => нет дублей.
    owner_id добавлен, чтобы быстро проверять tenant и делать индексы.
    """

    __tablename__ = "shop_category_links"  # type: ignore
    owner_id: uuid.UUID = Field(index=True)
    shop_id: uuid.UUID = Field(foreign_key="shops.id", primary_key=True)
    category_id: uuid.UUID = Field(foreign_key="shop_categories.id", primary_key=True)
    __table_args__ = (
        Index("ix_shop_cat_link_owner_shop", "owner_id", "shop_id"),
        Index("ix_shop_cat_link_owner_cat", "owner_id", "category_id"),
    )


class Shop(SQLModel, table=True):
    __tablename__ = "shops"  # type: ignore
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(index=True)
    shop_owner_id: uuid.UUID | None = Field(
        default=None, foreign_key="shop_owners.id", index=True, nullable=True
    )
    retail_name: str = Field(sa_type=String, nullable=False, index=True)
    address: str = Field(sa_type=String, nullable=False)
    is_favorite: bool = Field(default=False, sa_type=Boolean, index=True)
    notes: str | None = Field(default=None, sa_type=String)
    is_active: bool = Field(default=True, index=True)
    receipts: list["Receipt"] = Relationship(back_populates="shop")
    shop_owner: ShopOwner | None = Relationship(back_populates="shops")
    # many-to-many
    categories: list["ShopCategory"] = Relationship(
        back_populates="shops",
        link_model=ShopCategoryLink,
    )
    __table_args__ = (
        UniqueConstraint(
            "owner_id", "retail_name", "address", name="uq_shops_owner_retail_address"
        ),
        Index("ix_shops_owner_retail", "owner_id", "retail_name"),
    )


class ShopCategory(SQLModel, table=True):
    __tablename__ = "shop_categories"  # type: ignore
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(index=True)
    name: str = Field(sa_type=String, index=True)
    is_active: bool = Field(default=True, index=True)
    shops: list[Shop] = Relationship(
        back_populates="categories",
        link_model=ShopCategoryLink,
    )
    __table_args__ = (
        UniqueConstraint("owner_id", "name", name="uq_shop_categories_owner_name"),
        Index("ix_shop_categories_owner_name", "owner_id", "name"),
    )


# --- Shop schemas ---
class ShopCategoryCreate(SQLModel):
    name: str


class ShopCategoryPublic(SQLModel):
    id: uuid.UUID
    name: str
    is_active: bool


class ShopCategorysPublic(SQLModel):
    """Paginated list of public shops categorys."""

    data: list[ShopCategoryPublic]
    count: int


class ShopCategoryUpdate(SQLModel):
    name: str | None = None
    is_active: bool | None = None


class SetShopCategories(SQLModel):
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class ShopCreate(SQLModel):
    retail_name: str | None = None
    address: str | None = None
    is_favorite: bool = False
    notes: str | None = None
    shop_owner_id: uuid.UUID | None = None


class ShopUpdate(SQLModel):
    retail_name: str | None = None
    address: str | None = None
    is_favorite: bool | None = None
    notes: str | None = None
    is_active: bool | None = None
    shop_owner_id: uuid.UUID | None = None


class ShopRead(SQLModel):
    id: uuid.UUID
    retail_name: str | None
    address: str | None
    is_favorite: bool
    notes: str | None
    is_active: bool
    shop_owner_id: uuid.UUID | None
    shop_owner: ShopOwnerPublic | None = None
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class ShopPublic(ShopRead):
    pass


class ShopsPublic(SQLModel):
    """Paginated list of public shops."""

    data: list[ShopRead]
    count: int


# --- Receipts ---
class ReceiptStatus(str, Enum):
    DRAFT = "draft"
    FINALIZED = "finalized"
    ARCHIVED = "archived"


class ReceiptSource(str, Enum):
    MANUAL = "manual"
    FNS_IMPORT = "fns_import"
    EXTERNAL_IMPORT = "external_import"


class Receipt(SQLModel, table=True):
    """Receipt database model."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    date_time: datetime = Field(sa_type=DateTime)

    code: int = Field(sa_type=Integer)
    cash_total_sum: int = Field(sa_type=BigInteger)
    credit_sum: int = Field(sa_type=BigInteger)
    ecash_total_sum: int = Field(sa_type=BigInteger)
    total_sum: int = Field(sa_type=BigInteger)
    prepaid_sum: int = Field(sa_type=BigInteger)
    provision_sum: int = Field(sa_type=BigInteger)

    fiscal_document_format_ver: int = Field(sa_type=Integer)
    fiscal_drive_number: str = Field(max_length=20, sa_type=String)
    fiscal_document_number: int = Field(sa_type=Integer)
    fiscal_sign: int = Field(sa_type=BigInteger)
    shift_number: int | None = Field(default=None, sa_type=Integer)
    kkt_reg_id: str = Field(max_length=20, sa_type=String)
    nds_10: int | None = Field(default=None, sa_type=BigInteger)
    nds_18: int | None = Field(default=None, sa_type=BigInteger)
    operation_type: int = Field(sa_type=Integer)
    request_number: int = Field(sa_type=Integer)
    taxation_type: int | None = Field(default=None, sa_type=Integer)
    applied_taxation_type: int | None = Field(default=None, sa_type=Integer)
    status: ReceiptStatus = Field(
        default=ReceiptStatus.DRAFT, sa_type=String, index=True
    )
    source: ReceiptSource = Field(
        default=ReceiptSource.MANUAL, sa_type=String, index=True
    )

    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="receipts")
    shop_id: uuid.UUID = Field(foreign_key="shops.id", index=True)
    shop: "Shop" = Relationship(back_populates="receipts")
    cashier_id: uuid.UUID | None = Field(
        default=None, foreign_key="cashier.id", nullable=True
    )
    cashier: Cashier | None = Relationship(back_populates="receipts")
    raw_backup: "ReceiptRawBackup" = Relationship(
        back_populates="receipt",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "uselist": False,
            "lazy": "selectin",
        },
    )
    items: list["ReceiptItem"] = Relationship(
        back_populates="receipt",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    __table_args__ = (
        UniqueConstraint(
            "fiscal_document_number",
            "fiscal_drive_number",
            "fiscal_sign",
            "date_time",
            "total_sum",
            name="uq_receipt_identity",
        ),
        Index("ix_receipt_owner_status", "owner_id", "status"),
        Index("ix_receipt_owner_source", "owner_id", "source"),
    )


class ReceiptRawBackup(SQLModel, table=True):
    """Raw receipt data with integrity control via hash."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    raw_json: dict = Field(
        sa_type=JSON,
        nullable=False,
    )

    source_hash: str = Field(
        sa_type=String,
        unique=True,
        nullable=False,
        index=True,
        max_length=64,
    )

    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="receipt_raw_backup")

    receipt_id: uuid.UUID = Field(
        foreign_key="receipt.id",
        unique=True,
        nullable=False,
    )
    receipt: Receipt | None = Relationship(back_populates="raw_backup")

    def __init__(self, **kwargs):
        if "raw_json" in kwargs and "source_hash" not in kwargs:
            kwargs["source_hash"] = self._compute_hash(kwargs["raw_json"])
        super().__init__(**kwargs)

    @staticmethod
    def _compute_hash(data: dict) -> str:
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(json_str.encode("utf-8")).hexdigest()

    def verify_integrity(self) -> bool:
        current_hash = self._compute_hash(self.raw_json)
        return current_hash == self.source_hash

    def update_hash(self) -> None:
        self.source_hash = self._compute_hash(self.raw_json)


class ReceiptItemCategoryLink(SQLModel, table=True):
    """
    Link-таблица M:N для категорий пунктов чека.
    Primary key на (receipt_item_id, category_id) => нет дублей.
    """

    __tablename__ = "receipt_item_category_links"  # type: ignore
    owner_id: uuid.UUID = Field(index=True)
    receipt_item_id: uuid.UUID = Field(
        foreign_key="receiptitem.id",
        primary_key=True,
    )
    category_id: uuid.UUID = Field(
        foreign_key="receipt_item_categories.id",
        primary_key=True,
    )
    __table_args__ = (
        Index("ix_receipt_item_cat_link_owner_item", "owner_id", "receipt_item_id"),
        Index("ix_receipt_item_cat_link_owner_cat", "owner_id", "category_id"),
    )


class ReceiptItem(SQLModel, table=True):
    """Receipt item database model."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)

    name: str = Field(sa_type=String, max_length=500)
    price: int = Field(sa_type=BigInteger)
    quantity: float = Field(sa_type=Float)
    sum: int = Field(sa_type=BigInteger)

    measure: str | None = Field(default="шт", sa_type=String, max_length=20)

    product_type: int | None = Field(default=None, sa_type=Integer)
    gtin: str | None = Field(default=None, sa_type=String, max_length=20)
    raw_product_code: str | None = Field(default=None, sa_type=String, max_length=50)

    receipt_id: uuid.UUID = Field(foreign_key="receipt.id", nullable=False)
    receipt: Receipt | None = Relationship(back_populates="items")
    categories: list["ReceiptItemCategory"] = Relationship(
        back_populates="items",
        link_model=ReceiptItemCategoryLink,
    )


class ReceiptItemCategory(SQLModel, table=True):
    __tablename__ = "receipt_item_categories"  # type: ignore
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(index=True)
    name: str = Field(sa_type=String, index=True)
    is_active: bool = Field(default=True, index=True)
    items: list[ReceiptItem] = Relationship(
        back_populates="categories",
        link_model=ReceiptItemCategoryLink,
    )
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "name",
            name="uq_receipt_item_categories_owner_name",
        ),
        Index("ix_receipt_item_categories_owner_name", "owner_id", "name"),
    )


# --- Receipt schemas ---
class ReceiptBase(SQLModel):
    date_time: datetime
    code: int
    cash_total_sum: int
    credit_sum: int
    ecash_total_sum: int
    total_sum: int
    prepaid_sum: int
    provision_sum: int
    fiscal_document_format_ver: int
    fiscal_drive_number: str = Field(max_length=20)
    fiscal_document_number: int
    fiscal_sign: int
    shift_number: int | None = None
    kkt_reg_id: str = Field(max_length=20)
    nds_10: int | None = None
    nds_18: int | None = None
    operation_type: int
    request_number: int
    taxation_type: int | None = None
    applied_taxation_type: int | None = None
    shop_id: uuid.UUID
    cashier_id: uuid.UUID | None = None
    status: ReceiptStatus = ReceiptStatus.DRAFT
    source: ReceiptSource = ReceiptSource.MANUAL


class ReceiptCreate(ReceiptBase):
    pass


class ReceiptUpdate(SQLModel):
    date_time: datetime | None = None
    code: int | None = None
    cash_total_sum: int | None = None
    credit_sum: int | None = None
    ecash_total_sum: int | None = None
    total_sum: int | None = None
    prepaid_sum: int | None = None
    provision_sum: int | None = None
    fiscal_document_format_ver: int | None = None
    fiscal_drive_number: str | None = Field(default=None, max_length=20)
    fiscal_document_number: int | None = None
    fiscal_sign: int | None = None
    shift_number: int | None = None
    kkt_reg_id: str | None = Field(default=None, max_length=20)
    nds_10: int | None = None
    nds_18: int | None = None
    operation_type: int | None = None
    request_number: int | None = None
    taxation_type: int | None = None
    applied_taxation_type: int | None = None
    shop_id: uuid.UUID | None = None
    cashier_id: uuid.UUID | None = None
    status: ReceiptStatus | None = None
    source: ReceiptSource | None = None


class ReceiptRead(ReceiptBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ReceiptPublic(ReceiptRead):
    pass


class ReceiptShort(SQLModel):
    id: uuid.UUID
    date_time: datetime
    total_sum: int
    cash_total_sum: int
    ecash_total_sum: int
    items_count: int
    shop_display: str | None = None
    shop: ShopRead | None = None


class ReceiptsShortPublic(SQLModel):
    data: list[ReceiptShort]
    count: int


class ReceiptsPublic(SQLModel):
    data: list[ReceiptRead]
    count: int


class ReceiptItemBase(SQLModel):
    name: str = Field(max_length=500)
    price: int
    quantity: float
    sum: int
    measure: str | None = Field(default="шт", max_length=20)
    product_type: int | None = None
    gtin: str | None = Field(default=None, max_length=20)
    raw_product_code: str | None = Field(default=None, max_length=50)


class ReceiptItemCreate(ReceiptItemBase):
    receipt_id: uuid.UUID


class ReceiptItemInlineCreate(ReceiptItemBase):
    """Receipt item payload for nested receipt creation."""

    pass


class ReceiptItemUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=500)
    price: int | None = None
    quantity: float | None = None
    sum: int | None = None
    measure: str | None = Field(default=None, max_length=20)
    product_type: int | None = None
    gtin: str | None = Field(default=None, max_length=20)
    raw_product_code: str | None = Field(default=None, max_length=50)
    receipt_id: uuid.UUID | None = None


class ReceiptItemRead(ReceiptItemBase):
    id: uuid.UUID
    receipt_id: uuid.UUID


class ReceiptItemPublic(ReceiptItemRead):
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class ReceiptItemsPublic(SQLModel):
    data: list[ReceiptItemRead]
    count: int


class ReceiptItemsWithCategoriesPublic(SQLModel):
    data: list[ReceiptItemPublic]
    count: int


class ReceiptItemGroupPublic(SQLModel):
    name: str
    quantity: float
    sum: int
    items_count: int


class ReceiptItemGroupsPublic(SQLModel):
    data: list[ReceiptItemGroupPublic]
    count: int


class ReceiptItemCategoryCreate(SQLModel):
    name: str


class ReceiptItemCategoryPublic(SQLModel):
    id: uuid.UUID
    name: str
    is_active: bool


class ReceiptImportError(SQLModel):
    line: int
    detail: str


class ReceiptImportSummary(SQLModel):
    imported: int
    skipped: int
    failed: int
    errors: list[ReceiptImportError] = Field(default_factory=list)


# --- Analytics schemas ---
class DashboardTotals(SQLModel):
    revenue: int
    receipts_count: int
    avg_receipt: float
    unique_shops: int


class DashboardPaymentSplit(SQLModel):
    cash_total_sum: int
    ecash_total_sum: int
    total_sum: int
    cash_percent: float
    ecash_percent: float


class DashboardTimeseriesPoint(SQLModel):
    date: str  # DD-MM-YYYY
    revenue: int
    receipts_count: int
    avg_receipt: float


class DashboardTopShop(SQLModel):
    shop_id: uuid.UUID
    shop_display: str | None = None
    shop_name: str | None = None
    shop_address: str | None = None
    total_sum: int
    receipts_count: int


class DashboardResponse(SQLModel):
    totals: DashboardTotals
    payment_split: DashboardPaymentSplit
    timeseries: list[DashboardTimeseriesPoint]
    top_shops: list[DashboardTopShop]
    latest_receipts: ReceiptsShortPublic


class ReceiptItemCategorysPublic(SQLModel):
    data: list[ReceiptItemCategoryPublic]
    count: int


class ReceiptItemCategoryUpdate(SQLModel):
    name: str | None = None
    is_active: bool | None = None


class SetReceiptItemCategories(SQLModel):
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class SetReceiptItemsCategoriesByName(SQLModel):
    name: str = Field(min_length=1, max_length=500)
    category_ids: list[uuid.UUID] = Field(default_factory=list)


class ReceiptWithItemsCreate(SQLModel):
    """Nested payload for creating a receipt with its items."""

    receipt: ReceiptCreate
    items: list[ReceiptItemInlineCreate] = Field(min_length=1)


class ReceiptWithItemsPublic(SQLModel):
    """Public representation of a receipt with nested items."""

    receipt: ReceiptRead
    items: list[ReceiptItemRead]


class ReceiptWithItemsFullPublic(SQLModel):
    """Full representation of a receipt with nested items and related entities."""

    receipt: ReceiptRead
    items: list[ReceiptItemRead]
    shop: ShopRead | None = None
    shop_owner: ShopOwnerPublic | None = None
    cashier: CashierPublic | None = None
