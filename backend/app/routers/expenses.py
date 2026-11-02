from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Currency, Transaction, User
from ..schemas import ExpenseConfirm, ExpenseUpdate, TransactionOut
from ..security import get_current_user
from ..services.ai_extractor import check_user_daily_limit, extract_expense_from_receipt
from ..services.storage import compute_sha256, remove_file, save_upload_file

router = APIRouter(prefix="/expenses", tags=["expenses"])


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


@router.post("/upload", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_user_daily_limit(db, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Batas harian ekstraksi AI untuk akun Anda telah tercapai. Coba lagi besok atau masukkan pengeluaran secara manual.",
        )

    # Simpan file lampiran
    attachment_path, original_name, mime_type, sha256_hash, file_bytes = await save_upload_file(
        file, current_user.id, db=db
    )

    # Deteksi duplikat bukti untuk user yang sama
    duplicate = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.attachment_sha256 == sha256_hash,
        )
        .first()
    )
    if duplicate:
        remove_file(attachment_path)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Foto/dokumen struk ini sudah pernah diunggah sebelumnya (ID Transaksi #{duplicate.id}).",
        )

    # Ambil daftar kategori pengeluaran milik user
    categories = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            Category.type == "expense",
            Category.is_active.is_(True),
        )
        .all()
    )
    cat_map = {c.name.lower(): c.id for c in categories}
    cat_names = list(cat_map.keys())

    # Ekstraksi AI (timeout 30 detik)
    ai_status, parsed, raw_json = extract_expense_from_receipt(
        image_bytes=file_bytes,
        mime_type=mime_type,
        available_categories=cat_names,
        db=db,
    )

    # Jika ekstraksi AI gagal, jangan simpan draft kosong, langsung lempar error message yang jelas
    if ai_status == "failed":
        remove_file(attachment_path)
        err_msg = (raw_json or {}).get("error") or "Gagal menganalisis struk dengan AI"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg,
        )

    # Parsing data hasil AI
    trx_date = None
    if parsed.get("date"):
        try:
            trx_date = date.fromisoformat(str(parsed["date"])[:10])
        except Exception:
            trx_date = None

    vendor = parsed.get("vendor") or None
    if not vendor or not str(vendor).strip():
        vendor = "Lainnya - Periksa lagi Nanti"
    else:
        vendor = str(vendor).strip()
    description = parsed.get("description") or None

    amount = None
    if parsed.get("total") is not None:
        try:
            val = int(float(str(parsed["total"]).replace(",", "").replace(".", "")))
            if val > 0:
                amount = val
        except Exception:
            amount = None

    category_id = None
    cat_name = str(parsed.get("category", "")).lower()
    if cat_name in cat_map:
        category_id = cat_map[cat_name]
    elif "lainnya" in cat_map:
        category_id = cat_map["lainnya"]

    trx = Transaction(
        user_id=current_user.id,
        type="expense",
        trx_date=trx_date,
        party=vendor,
        description=description,
        category_id=category_id,
        amount=amount,
        currency_code="IDR",
        payment_method="Online",
        status="draft",
        input_method="ai_receipt",
        attachment_path=attachment_path,
        attachment_name=original_name,
        attachment_mime=mime_type,
        attachment_sha256=sha256_hash,
        ai_status=ai_status,
        ai_raw_json=raw_json,
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return _to_transaction_out(trx)


@router.get("/drafts", response_model=list[TransactionOut])
def list_drafts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    drafts = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.status == "draft",
        )
        .order_by(Transaction.id.desc())
        .all()
    )
    return [_to_transaction_out(d) for d in drafts]


@router.post("/drafts/approve-all")
def approve_all_drafts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Menyetujui (approve) semua draft pengeluaran milik pengguna saat ini."""
    drafts = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.status == "draft",
        )
        .all()
    )
    if not drafts:
        return {
            "message": "Tidak ada draft pengeluaran untuk disetujui",
            "approved_count": 0,
            "skipped_count": 0,
        }

    categories = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            Category.type == "expense",
            Category.is_active.is_(True),
        )
        .all()
    )
    if not categories:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda belum memiliki kategori pengeluaran aktif. Silakan buat atau isi kategori standar terlebih dahulu.",
        )

    # Kategori fallback: 'lainnya' atau kategori pertama yang aktif
    cat_fallback = next((c for c in categories if c.name.lower() == "lainnya"), categories[0])
    valid_cat_ids = {c.id for c in categories}

    approved_count = 0
    skipped_count = 0

    for d in drafts:
        # Validasi nominal: harus memiliki nominal > 0
        if not d.amount or d.amount <= 0:
            skipped_count += 1
            continue

        if not d.trx_date:
            d.trx_date = d.created_at.date() if d.created_at else date.today()

        if not d.party or not d.party.strip():
            d.party = "Lainnya - Periksa lagi Nanti"
        else:
            d.party = d.party.strip()

        if not d.category_id or d.category_id not in valid_cat_ids:
            d.category_id = cat_fallback.id

        if not d.payment_method or not d.payment_method.strip():
            d.payment_method = "Online"

        if not d.currency_code:
            d.currency_code = "IDR"

        d.status = "confirmed"
        approved_count += 1

    db.commit()

    msg = f"Berhasil menyetujui {approved_count} draft pengeluaran!"
    if skipped_count > 0:
        msg += f" ({skipped_count} draft dilewati karena belum memiliki nominal)"

    return {
        "message": msg,
        "approved_count": approved_count,
        "skipped_count": skipped_count,
    }


@router.patch("/{id}", response_model=TransactionOut)
def update_draft_expense(
    id: int,
    body: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = (
        db.query(Transaction)
        .filter(
            Transaction.id == id,
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
        )
        .first()
    )
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data pengeluaran tidak ditemukan")

    if body.trx_date is not None:
        trx.trx_date = body.trx_date
    if body.party is not None:
        trx.party = body.party.strip()
    if body.category_id is not None:
        # Cek kategori
        cat = db.query(Category).filter(
            Category.id == body.category_id,
            Category.type == "expense",
            Category.is_active.is_(True),
            Category.user_id == current_user.id,
        ).first()
        if not cat:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kategori pengeluaran tidak valid")
        trx.category_id = cat.id
    if body.amount is not None:
        trx.amount = body.amount
    if body.currency_code is not None:
        curr = db.query(Currency).filter(Currency.code == body.currency_code.upper(), Currency.is_active.is_(True)).first()
        if not curr:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mata uang tidak valid")
        trx.currency_code = curr.code
    if body.payment_method is not None:
        trx.payment_method = body.payment_method.strip()
    if body.description is not None:
        trx.description = body.description.strip()

    db.commit()
    db.refresh(trx)
    return _to_transaction_out(trx)


@router.post("/{id}/confirm", response_model=TransactionOut)
def confirm_expense(
    id: int,
    body: ExpenseConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trx = (
        db.query(Transaction)
        .filter(
            Transaction.id == id,
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
        )
        .first()
    )
    if not trx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Data pengeluaran tidak ditemukan")

    # Validasi kategori
    cat = db.query(Category).filter(
        Category.id == body.category_id,
        Category.type == "expense",
        Category.is_active.is_(True),
        Category.user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kategori pengeluaran tidak valid")

    # Validasi currency
    curr = db.query(Currency).filter(Currency.code == body.currency_code.upper(), Currency.is_active.is_(True)).first()
    if not curr:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mata uang tidak valid")

    trx.trx_date = body.trx_date
    trx.party = body.party.strip()
    trx.category_id = cat.id
    trx.amount = body.amount
    trx.currency_code = curr.code
    trx.payment_method = (body.payment_method.strip() if body.payment_method else None) or "Online"
    trx.description = body.description.strip() if body.description else None
    trx.status = "confirmed"

    db.commit()
    db.refresh(trx)
    return _to_transaction_out(trx)


@router.post("/manual", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_manual_expense(
    trx_date: date = Form(...),
    party: str = Form(..., min_length=1, max_length=200),
    category_id: int = Form(...),
    amount: int = Form(..., gt=0),
    currency_code: str = Form(default="IDR"),
    payment_method: str | None = Form(default="Online"),
    description: str | None = Form(default=None),
    attachment: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter(
        Category.id == category_id,
        Category.type == "expense",
        Category.is_active.is_(True),
        Category.user_id == current_user.id,
    ).first()
    if not cat:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kategori pengeluaran tidak valid")

    curr = db.query(Currency).filter(Currency.code == currency_code.upper(), Currency.is_active.is_(True)).first()
    if not curr:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mata uang tidak valid")

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
        type="expense",
        trx_date=trx_date,
        party=party.strip(),
        description=description.strip() if description else None,
        category_id=cat.id,
        amount=amount,
        currency_code=curr.code,
        payment_method=(payment_method.strip() if payment_method else None) or "Online",
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

