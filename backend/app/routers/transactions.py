from datetime import date
import os
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Transaction, User
from ..schemas import TransactionOut, TransactionUpdate
from ..security import get_current_user
from ..services.storage import remove_file

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_transaction_out(trx: Transaction) -> TransactionOut:
    return TransactionOut(
        id=trx.id,
        user_id=trx.user_id,
        type=trx.type,
        trx_date=trx.trx_date,
        party=trx.party,
        description=trx.description,
        category_id=trx.category_id,
        category_name=trx.category.name if trx.category else None,
        amount=trx.amount,
        currency_code=trx.currency_code,
        payment_method=trx.payment_method,
        status=trx.status,
        input_method=trx.input_method,
        has_attachment=bool(trx.attachment_path),
        attachment_name=trx.attachment_name,
        attachment_mime=trx.attachment_mime,
        ai_status=trx.ai_status,
        created_at=trx.created_at,
        updated_at=trx.updated_at,
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    type: str | None = Query(default=None, pattern=r"^(income|expense)$"),
    status_filter: str | None = Query(default=None, alias="status", pattern=r"^(draft|confirmed)$"),
    category_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if type:
        query = query.filter(Transaction.type == type)
    if status_filter:
        query = query.filter(Transaction.status == status_filter)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if date_from:
        query = query.filter(Transaction.trx_date >= date_from)
    if date_to:
        query = query.filter(Transaction.trx_date <= date_to)
    if search:
        kw = f"%{search.strip()}%"
        query = query.filter(or_(Transaction.party.ilike(kw), Transaction.description.ilike(kw)))

    transactions = (
        query.order_by(Transaction.trx_date.is_(None), Transaction.trx_date.desc(), Transaction.id.desc())
        .all()
    )
    return [_to_transaction_out(t) for t in transactions]


@router.get("/{id}/attachment")
def get_attachment(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = (
        db.query(Transaction)
        .filter(Transaction.id == id, Transaction.user_id == current_user.id)
        .first()
    )
    if not trx or not trx.attachment_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File lampiran tidak ditemukan")

    if not os.path.exists(trx.attachment_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File fisik tidak ditemukan pada server")

    return FileResponse(
        path=trx.attachment_path,
        media_type=trx.attachment_mime or "application/octet-stream",
        filename=trx.attachment_name or "attachment",
    )


@router.patch("/{id}", response_model=TransactionOut)
def update_transaction(
    id: int,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = (
        db.query(Transaction)
        .filter(Transaction.id == id, Transaction.user_id == current_user.id)
        .first()
    )
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")

    if body.party is not None:
        clean_party = body.party.strip()
        if not clean_party:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nama Pihak/Vendor tidak boleh kosong")
        trx.party = clean_party

    if body.description is not None:
        trx.description = body.description.strip() or None

    if body.trx_date is not None:
        trx.trx_date = body.trx_date

    if body.amount is not None:
        trx.amount = body.amount

    if body.payment_method is not None:
        trx.payment_method = body.payment_method.strip() or None

    if body.category_id is not None:
        cat = (
            db.query(Category)
            .filter(
                Category.id == body.category_id,
                Category.type == trx.type,
                Category.is_active.is_(True),
                Category.user_id == current_user.id,
            )
            .first()
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kategori tidak valid")
        trx.category_id = body.category_id

    db.commit()
    db.refresh(trx)
    return _to_transaction_out(trx)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = (
        db.query(Transaction)
        .filter(Transaction.id == id, Transaction.user_id == current_user.id)
        .first()
    )
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaksi tidak ditemukan")

    # Bersihkan file fisik
    if trx.attachment_path:
        remove_file(trx.attachment_path)

    db.delete(trx)
    db.commit()

