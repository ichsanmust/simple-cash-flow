from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


# ---------------- AUTH & USER ----------------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_.-]+$")
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6)
    role: str = Field(default="user", pattern=r"^(admin|user)$")


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    role: str | None = Field(default=None, pattern=r"^(admin|user)$")
    is_active: bool | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


# ---------------- CURRENCY ----------------
class CurrencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    symbol: str
    decimal_places: int
    is_active: bool


class CurrencyCreate(BaseModel):
    code: str = Field(min_length=3, max_length=3)
    name: str = Field(min_length=1, max_length=50)
    symbol: str = Field(min_length=1, max_length=5)
    decimal_places: int = Field(default=0, ge=0, le=4)


class CurrencyUpdate(BaseModel):
    name: str | None = None
    symbol: str | None = None
    is_active: bool | None = None


# ---------------- CATEGORY ----------------
class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    name: str
    type: str
    is_active: bool


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str = Field(pattern=r"^(income|expense)$")


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active: bool | None = None


class CategoryCheckOut(BaseModel):
    has_categories: bool
    count: int
    income_count: int
    expense_count: int


# ---------------- TRANSACTIONS ----------------
class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    type: str
    trx_date: date | None
    party: str | None
    description: str | None
    category_id: int | None
    category_name: str | None = None
    amount: int | None
    currency_code: str
    payment_method: str | None
    status: str
    input_method: str
    has_attachment: bool = False
    attachment_name: str | None = None
    attachment_mime: str | None = None
    ai_status: str | None = None
    created_at: datetime
    updated_at: datetime


class IncomeCreateJson(BaseModel):
    trx_date: date
    party: str = Field(min_length=1, max_length=200)
    category_id: int
    amount: int = Field(gt=0)
    currency_code: str = "IDR"
    payment_method: str | None = None
    description: str | None = None


class ExpenseConfirm(BaseModel):
    trx_date: date
    party: str = Field(min_length=1, max_length=200)
    category_id: int
    amount: int = Field(gt=0)
    currency_code: str = "IDR"
    payment_method: str | None = None
    description: str | None = None


class ExpenseUpdate(BaseModel):
    trx_date: date | None = None
    party: str | None = None
    category_id: int | None = None
    amount: int | None = Field(default=None, gt=0)
    currency_code: str | None = None
    payment_method: str | None = None
    description: str | None = None


class TransactionUpdate(BaseModel):
    party: str | None = None
    description: str | None = None
    trx_date: date | None = None
    category_id: int | None = None
    amount: int | None = Field(default=None, gt=0)
    payment_method: str | None = None


# ---------------- REPORT / SUMMARY ----------------
class SummaryResponse(BaseModel):
    total_income: int
    total_expense: int
    balance: int
    currency_code: str
    expense_by_category: dict[str, int]
    income_by_category: dict[str, int]
    pending_drafts_count: int


# ---------------- AI MODELS & SETTINGS ----------------
class AIModelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    model_id: str
    provider: str
    description: str | None = None
    is_active: bool
    is_custom: bool
    created_at: datetime


class AIModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    model_id: str = Field(min_length=1, max_length=150)
    provider: str = Field(default="OpenRouter", max_length=50)
    description: str | None = None


class AIModelUpdate(BaseModel):
    name: str | None = None
    model_id: str | None = None
    provider: str | None = None
    description: str | None = None


class AISettingsUpdate(BaseModel):
    openrouter_api_key: str | None = None
    active_model_id: str | None = None


class AISettingsOut(BaseModel):
    active_model_id: str
    active_model_name: str | None = None
    openrouter_api_key_masked: str | None = None
    has_openrouter_api_key: bool


class AITestRequest(BaseModel):
    model_id: str | None = None
    api_key: str | None = None


class AITestResponse(BaseModel):
    success: bool
    message: str
    latency_ms: int | None = None
    model: str | None = None


# ---------------- SYSTEM / APP SETTINGS ----------------
class SystemSettingsOut(BaseModel):
    ai_daily_limit_per_user: int
    upload_dir: str
    max_upload_mb: int
    openrouter_api_key_masked: str
    has_openrouter_api_key: bool
    active_model_id: str
    active_model_name: str | None = None


class SystemSettingsUpdate(BaseModel):
    ai_daily_limit_per_user: int | None = Field(default=None, ge=1, le=1000)
    upload_dir: str | None = Field(default=None, min_length=1, max_length=200)
    max_upload_mb: int | None = Field(default=None, ge=1, le=100)
    openrouter_api_key: str | None = None



