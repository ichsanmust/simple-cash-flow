from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Category, Transaction, User
from ..schemas import (
    CategoryCheckOut,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
)
from ..security import get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])

DEFAULT_EXPENSE_CATEGORIES = [
    "makanan",
    "transportasi",
    "utilitas",
    "belanja",
    "kesehatan",
    "hiburan",
    "pendidikan",
    "lainnya",
]

DEFAULT_INCOME_CATEGORIES = [
    "gaji",
    "usaha",
    "investasi",
    "hadiah",
    "freelance",
    "lainnya",
]


@router.get("/check", response_model=CategoryCheckOut)
def check_user_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Memeriksa status kategori milik pengguna saat ini."""
    cats = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .all()
    )
    income_count = sum(1 for c in cats if c.type == "income" and c.is_active)
    expense_count = sum(1 for c in cats if c.type == "expense" and c.is_active)
    total_count = len(cats)
    return CategoryCheckOut(
        has_categories=total_count > 0,
        count=total_count,
        income_count=income_count,
        expense_count=expense_count,
    )


@router.post("/seed-defaults", response_model=list[CategoryOut])
def seed_default_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Menambahkan kategori standar bawaan (pemasukan & pengeluaran) untuk pengguna saat ini."""
    existing = {
        (c.type, c.name.lower())
        for c in db.query(Category).filter(Category.user_id == current_user.id).all()
    }

    created = []
    for cat_name in DEFAULT_EXPENSE_CATEGORIES:
        if ("expense", cat_name.lower()) not in existing:
            cat = Category(
                user_id=current_user.id,
                name=cat_name.lower(),
                type="expense",
                is_active=True,
            )
            db.add(cat)
            created.append(cat)

    for cat_name in DEFAULT_INCOME_CATEGORIES:
        if ("income", cat_name.lower()) not in existing:
            cat = Category(
                user_id=current_user.id,
                name=cat_name.lower(),
                type="income",
                is_active=True,
            )
            db.add(cat)
            created.append(cat)

    db.commit()

    all_user_cats = (
        db.query(Category)
        .filter(Category.user_id == current_user.id)
        .order_by(Category.name.asc())
        .all()
    )
    return [CategoryOut.model_validate(c) for c in all_user_cats]


@router.get("", response_model=list[CategoryOut])
def list_categories(
    type: str | None = Query(default=None, pattern=r"^(income|expense)$"),
    include_inactive: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Daftar kategori milik pengguna yang sedang login."""
    query = db.query(Category).filter(Category.user_id == current_user.id)
    if not include_inactive:
        query = query.filter(Category.is_active.is_(True))
    if type:
        query = query.filter(Category.type == type)

    categories = query.order_by(Category.name.asc()).all()
    return [CategoryOut.model_validate(c) for c in categories]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Membuat kategori baru untuk pengguna saat ini."""
    clean_name = body.name.strip().lower()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nama kategori tidak boleh kosong",
        )

    existing = (
        db.query(Category)
        .filter(
            Category.user_id == current_user.id,
            Category.type == body.type,
            Category.name == clean_name,
        )
        .first()
    )
    if existing:
        if not existing.is_active:
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return CategoryOut.model_validate(existing)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kategori '{clean_name}' untuk {body.type} sudah ada",
        )

    new_cat = Category(
        user_id=current_user.id,
        name=clean_name,
        type=body.type,
        is_active=True,
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return CategoryOut.model_validate(new_cat)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    body: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mengubah nama atau status aktif kategori milik pengguna."""
    cat = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            Category.user_id == current_user.id,
        )
        .first()
    )
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategori tidak ditemukan",
        )

    if body.name is not None:
        clean_name = body.name.strip().lower()
        if not clean_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nama kategori tidak boleh kosong",
            )
        # Cek apakah nama baru bentrok dengan kategori lain milik user
        dup = (
            db.query(Category)
            .filter(
                Category.user_id == current_user.id,
                Category.type == cat.type,
                Category.name == clean_name,
                Category.id != cat.id,
            )
            .first()
        )
        if dup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kategori '{clean_name}' untuk {cat.type} sudah ada",
            )
        cat.name = clean_name

    if body.is_active is not None:
        cat.is_active = body.is_active

    db.commit()
    db.refresh(cat)
    return CategoryOut.model_validate(cat)


@router.delete("/{category_id}", status_code=status.HTTP_200_OK)
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Menghapus kategori milik pengguna. Jika sudah digunakan pada transaksi, wajib dinonaktifkan."""
    cat = (
        db.query(Category)
        .filter(
            Category.id == category_id,
            Category.user_id == current_user.id,
        )
        .first()
    )
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kategori tidak ditemukan",
        )

    # Cek transaksi milik user yang memakai kategori ini
    trx_count = (
        db.query(Transaction)
        .filter(
            Transaction.category_id == cat.id,
            Transaction.user_id == current_user.id,
        )
        .count()
    )
    if trx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kategori '{cat.name}' telah digunakan pada {trx_count} transaksi. Anda tidak dapat menghapusnya langsung, silakan nonaktifkan kategori ini agar tidak muncul di pilihan baru.",
        )

    db.delete(cat)
    db.commit()
    return {"message": f"Kategori '{cat.name}' berhasil dihapus"}
