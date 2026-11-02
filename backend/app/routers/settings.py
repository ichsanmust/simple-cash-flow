from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings as env_settings
from ..db import get_db
from ..models import AIModel, AppSetting, User
from ..schemas import SystemSettingsOut, SystemSettingsUpdate
from ..security import require_admin

router = APIRouter(prefix="/settings", tags=["settings"])


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    clean = key.strip()
    if len(clean) <= 10:
        return "•" * len(clean)
    return f"{clean[:8]}••••••••{clean[-4:]}"


def _get_setting_val(db: Session, key: str, default: str) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value is not None else default


def _set_setting_val(db: Session, key: str, value: str, description: str = ""):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value, description=description))


@router.get("", response_model=SystemSettingsOut)
def get_system_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mengambil seluruh konfigurasi sistem (khusus Administrator)."""
    limit_str = _get_setting_val(db, "ai_daily_limit_per_user", str(env_settings.ai_daily_limit_per_user))
    upload_dir = _get_setting_val(db, "upload_dir", env_settings.upload_dir)
    max_mb_str = _get_setting_val(db, "max_upload_mb", str(env_settings.max_upload_mb))

    raw_key = _get_setting_val(db, "openrouter_api_key", env_settings.openrouter_api_key)

    active_model_row = db.query(AIModel).filter(AIModel.is_active.is_(True)).first()
    active_model_id = (
        active_model_row.model_id
        if active_model_row
        else _get_setting_val(db, "active_model_id", "google/gemini-2.5-flash")
    )
    active_model_name = active_model_row.name if active_model_row else "Google Gemini 2.5 Flash"

    return SystemSettingsOut(
        ai_daily_limit_per_user=int(limit_str) if limit_str.isdigit() else 20,
        upload_dir=upload_dir,
        max_upload_mb=int(max_mb_str) if max_mb_str.isdigit() else 5,
        openrouter_api_key_masked=_mask_key(raw_key),
        has_openrouter_api_key=bool(raw_key.strip()),
        active_model_id=active_model_id,
        active_model_name=active_model_name,
    )


@router.post("", response_model=SystemSettingsOut)
def update_system_settings(
    body: SystemSettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Memperbarui pengaturan sistem di database (khusus Administrator)."""
    if body.ai_daily_limit_per_user is not None:
        _set_setting_val(
            db,
            "ai_daily_limit_per_user",
            str(body.ai_daily_limit_per_user),
            "Batas harian ekstraksi AI per user",
        )

    if body.upload_dir is not None:
        _set_setting_val(
            db,
            "upload_dir",
            body.upload_dir.strip(),
            "Folder penyimpanan file bukti unggahan",
        )

    if body.max_upload_mb is not None:
        _set_setting_val(
            db,
            "max_upload_mb",
            str(body.max_upload_mb),
            "Maksimal ukuran unggahan file dalam MB",
        )

    if body.openrouter_api_key is not None:
        _set_setting_val(
            db,
            "openrouter_api_key",
            body.openrouter_api_key.strip(),
            "API Key OpenRouter AI",
        )

    db.commit()
    return get_system_settings(current_user=current_user, db=db)

