from datetime import date, datetime
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(10), default="user", nullable=False)  # 'admin' | 'user'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories: Mapped[list["Category"]] = relationship("Category", back_populates="user")


class Currency(Base):
    __tablename__ = "currencies"

    code: Mapped[str] = mapped_column(String(3), primary_key=True)  # 'IDR', 'USD'
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(5), nullable=False)
    decimal_places: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="currency")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'income' | 'expense'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User | None] = relationship("User", back_populates="categories")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="category")

    __table_args__ = (
        UniqueConstraint("user_id", "type", "name", name="uq_user_type_name"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'income' | 'expense'
    trx_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    party: Mapped[str | None] = mapped_column(String(200), nullable=True)  # vendor / sumber dana
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # Rupiah utuh / sen
    currency_code: Mapped[str] = mapped_column(String(3), ForeignKey("currencies.code"), default="IDR", nullable=False, index=True)
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="draft", nullable=False)  # 'draft' | 'confirmed'
    input_method: Mapped[str] = mapped_column(String(12), default="form", nullable=False)  # 'form' | 'ai_receipt'

    attachment_path: Mapped[str | None] = mapped_column(String(300), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    attachment_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    attachment_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    ai_status: Mapped[str | None] = mapped_column(String(10), nullable=True)  # 'success' | 'failed'
    ai_raw_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user: Mapped[User] = relationship("User", back_populates="transactions")
    category: Mapped[Category | None] = relationship("Category", back_populates="transactions")
    currency: Mapped[Currency] = relationship("Currency", back_populates="transactions")

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')", name="check_trx_type"),
        CheckConstraint("amount IS NULL OR amount > 0", name="check_trx_amount"),
    )


class AIModel(Base):
    __tablename__ = "ai_models"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_id: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="OpenRouter", nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


