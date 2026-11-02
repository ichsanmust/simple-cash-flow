from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Transaction, User
from ..schemas import SummaryResponse
from ..security import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    date_from: date | None = None,
    date_to: date | None = None,
    currency_code: str = Query(default="IDR"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.status == "confirmed",
        Transaction.currency_code == currency_code.upper(),
    )
    if date_from:
        base_query = base_query.filter(Transaction.trx_date >= date_from)
    if date_to:
        base_query = base_query.filter(Transaction.trx_date <= date_to)

    # Total Income
    total_income = (
        base_query.filter(Transaction.type == "income")
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0))
        .scalar()
        or 0
    )

    # Total Expense
    total_expense = (
        base_query.filter(Transaction.type == "expense")
        .with_entities(func.coalesce(func.sum(Transaction.amount), 0))
        .scalar()
        or 0
    )

    # Expense by category
    expense_rows = (
        base_query.filter(Transaction.type == "expense")
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .with_entities(func.coalesce(Category.name, "Lainnya"), func.sum(Transaction.amount))
        .group_by(Category.name)
        .all()
    )
    expense_by_cat = {row[0]: int(row[1] or 0) for row in expense_rows}

    # Income by category
    income_rows = (
        base_query.filter(Transaction.type == "income")
        .join(Category, Transaction.category_id == Category.id, isouter=True)
        .with_entities(func.coalesce(Category.name, "Lainnya"), func.sum(Transaction.amount))
        .group_by(Category.name)
        .all()
    )
    income_by_cat = {row[0]: int(row[1] or 0) for row in income_rows}

    # Hitung jumlah draft yang belum dikonfirmasi
    pending_drafts = (
        db.query(func.count(Transaction.id))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.status == "draft",
        )
        .scalar()
        or 0
    )

    return SummaryResponse(
        total_income=int(total_income),
        total_expense=int(total_expense),
        balance=int(total_income - total_expense),
        currency_code=currency_code.upper(),
        expense_by_category=expense_by_cat,
        income_by_category=income_by_cat,
        pending_drafts_count=int(pending_drafts),
    )

