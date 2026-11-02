from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Currency, Transaction, User
from ..schemas import TransactionOut
from ..security import get_current_user
from ..services.storage import remove_file, save_upload_file

router = APIRouter(prefix="/incomes", tags=["incomes"])


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


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_income(
    trx_date: date = Form(...),
    party: str = Form(..., min_length=1, max_length=200),
    category_id: int = Form(...),
    amount: int = Form(..., gt=0),
    currency_code: str = Form(default="IDR"),
    payment_method: str | None = Form(default=None),
    description: str | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validasi Kategori
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.is_active.is_(True),
        Category.type == "income",
        Category.user_id == current_user.id,
    ).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kategori tidak valid atau bukan kategori pemasukan",
        )

    # Validasi Currency
    currency = db.query(Currency).filter(Currency.code == currency_code.upper(), Currency.is_active.is_(True)).first()
    if not currency:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Mata uang '{currency_code}' tidak aktif")

    attachment_path = None
    attachment_name = None
    attachment_mime = None
    attachment_sha256 = None

    if attachment and attachment.filename:
        attachment_path, attachment_name, attachment_mime, attachment_sha256, _ = await save_upload_file(
            attachment, current_user.id, db=db
        )

    trx = Transaction(
        user_id=current_user.id,
        type="income",
        trx_date=trx_date,
        party=party.strip(),
        description=description.strip() if description else None,
        category_id=category.id,
        amount=amount,
        currency_code=currency.code,
        payment_method=payment_method.strip() if payment_method else None,
        status="confirmed",
        input_method="form",
        attachment_path=attachment_path,
        attachment_name=attachment_name,
        attachment_mime=attachment_mime,
        attachment_sha256=attachment_sha256,
        ai_status=None,
        ai_raw_json=None,
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return _to_transaction_out(trx)


@router.get("/{id}", response_model=TransactionOut)
def get_income(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = db.query(Transaction).filter(
        Transaction.id == id,
        Transaction.user_id == current_user.id,
        Transaction.type == "income",
    ).first()
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pemasukan tidak ditemukan")
    return _to_transaction_out(trx)

