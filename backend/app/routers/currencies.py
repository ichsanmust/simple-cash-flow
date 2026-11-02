from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Currency, User
from ..schemas import CurrencyCreate, CurrencyOut, CurrencyUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/currencies", tags=["currencies"])


@router.get("", response_model=list[CurrencyOut])
def list_currencies(
    include_inactive: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Currency)
    if not include_inactive or current_user.role != "admin":
        query = query.filter(Currency.is_active.is_(True))
    currencies = query.order_by(Currency.code.asc()).all()
    return [CurrencyOut.model_validate(c) for c in currencies]


@router.post("", response_model=CurrencyOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_currency(body: CurrencyCreate, db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    existing = db.query(Currency).filter(Currency.code == code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mata uang dengan kode '{code}' sudah ada",
        )

    curr = Currency(
        code=code,
        name=body.name.strip(),
        symbol=body.symbol.strip(),
        decimal_places=body.decimal_places,
        is_active=True,
    )
    db.add(curr)
    db.commit()
    db.refresh(curr)
    return CurrencyOut.model_validate(curr)


@router.patch("/{code}", response_model=CurrencyOut, dependencies=[Depends(require_admin)])
def update_currency(code: str, body: CurrencyUpdate, db: Session = Depends(get_db)):
    code = code.strip().upper()
    curr = db.query(Currency).filter(Currency.code == code).first()
    if not curr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mata uang tidak ditemukan")

    if body.name is not None:
        curr.name = body.name.strip()
    if body.symbol is not None:
        curr.symbol = body.symbol.strip()
    if body.is_active is not None:
        curr.is_active = body.is_active

    db.commit()
    db.refresh(curr)
    return CurrencyOut.model_validate(curr)

