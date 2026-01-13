from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Boolean, Text, JSON, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    receipts = relationship("Receipt", back_populates="owner")
    categories = relationship("ProductCategory", back_populates="owner")
    tags = relationship("ReceiptTag", back_populates="owner")


class Receipt(Base):
    __tablename__ = "receipts"

    receipt_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"))
    fiscal_drive_number = Column(String(20), nullable=False)
    fiscal_document_number = Column(Integer, nullable=False)
    fiscal_sign = Column(BigInteger, nullable=False)
    date_time = Column(DateTime(timezone=True), nullable=False)
    total_sum = Column(Numeric(12, 2), nullable=False)
    cash_total_sum = Column(Numeric(12, 2), default=0)
    ecash_total_sum = Column(Numeric(12, 2), default=0)
    credit_sum = Column(Numeric(12, 2), default=0)
    prepaid_sum = Column(Numeric(12, 2), default=0)
    provision_sum = Column(Numeric(12, 2), default=0)
    retail_place = Column(String(255))
    retail_place_address = Column(Text)
    operator_name = Column(String(255))
    operator_inn = Column(String(20))
    shift_number = Column(Integer)
    kkt_reg_id = Column(String(30))
    fns_url = Column(String(255))
    taxation_type = Column(Integer)
    applied_taxation_type = Column(Integer)
    nds10 = Column(Numeric(12, 2), default=0)
    nds18 = Column(Numeric(12, 2), default=0)
    user_org_name = Column(String(255))
    user_org_inn = Column(String(20))
    raw_data = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="receipts")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")
    tags = relationship("ReceiptTagMapping", back_populates="receipt")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    item_id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.receipt_id", ondelete="CASCADE"))
    name = Column(String(500), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Numeric(10, 3), nullable=False)
    sum = Column(Numeric(12, 2), nullable=False)
    nds = Column(Integer)
    product_type = Column(Integer)
    payment_type = Column(Integer, default=4)
    gtin = Column(String(14))
    product_id_type = Column(Integer)
    serial_number = Column(String(100))
    raw_product_code = Column(Text)

    receipt = relationship("Receipt", back_populates="items")


class ProductCategory(Base):
    __tablename__ = "product_categories"

    category_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"))
    category_name = Column(String(100), nullable=False)
    description = Column(Text)
    parent_category_id = Column(Integer, ForeignKey("product_categories.category_id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="categories")
    parent = relationship("ProductCategory", remote_side=[category_id])


class ReceiptTag(Base):
    __tablename__ = "receipt_tags"

    tag_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"))
    tag_name = Column(String(50), nullable=False)
    color = Column(String(7))

    owner = relationship("User", back_populates="tags")
    receipts = relationship("ReceiptTagMapping", back_populates="tag")


class ReceiptTagMapping(Base):
    __tablename__ = "receipt_tag_mapping"

    receipt_id = Column(Integer, ForeignKey("receipts.receipt_id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("receipt_tags.tag_id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"))

    receipt = relationship("Receipt", back_populates="tags")
    tag = relationship("ReceiptTag", back_populates="receipts")