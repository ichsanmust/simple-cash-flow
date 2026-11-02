from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AIModel, AppSetting, User
from ..schemas import (
    AIModelCreate,
    AIModelOut,
    AIModelUpdate,
    AISettingsOut,
    AISettingsUpdate,
    AITestRequest,
    AITestResponse,
)
from ..security import get_current_user, require_admin
from ..services.ai_extractor import test_ai_connection

router = APIRouter(prefix="/ai-models", tags=["ai-models"])


def _mask_api_key(key: str | None) -> str:
    if not key:
        return ""
    clean = key.strip()
    if len(clean) <= 10:
        return "•" * len(clean)
    return f"{clean[:8]}••••••••{clean[-4:]}"


@router.get("/active")
def get_active_model(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mengambil informasi model AI aktif yang saat ini digunakan (bisa diakses semua user)."""
    model = db.query(AIModel).filter(AIModel.is_active.is_(True)).first()
    if not model:
        model = db.query(AIModel).first()
    return {
        "model_id": model.model_id if model else "google/gemini-2.5-flash",
        "name": model.name if model else "Google Gemini 2.5 Flash",
        "provider": model.provider if model else "OpenRouter",
    }


@router.get("")
def list_ai_models_and_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mengambil daftar model AI dan pengaturan API key (hanya Admin)."""
    models = db.query(AIModel).order_by(AIModel.is_active.desc(), AIModel.id.asc()).all()

    key_setting = db.query(AppSetting).filter(AppSetting.key == "openrouter_api_key").first()
    raw_key = key_setting.value if key_setting and key_setting.value else ""

    active_model = next((m for m in models if m.is_active), None)

    settings_out = AISettingsOut(
        active_model_id=active_model.model_id if active_model else "google/gemini-2.5-flash",
        active_model_name=active_model.name if active_model else "Google Gemini 2.5 Flash",
        openrouter_api_key_masked=_mask_api_key(raw_key),
        has_openrouter_api_key=bool(raw_key.strip()),
    )

    return {
        "models": [_to_ai_model_out(m) for m in models],
        "settings": settings_out,
    }


def _to_ai_model_out(m: AIModel) -> AIModelOut:
    return AIModelOut(
        id=m.id,
        name=m.name,
        model_id=m.model_id,
        provider=m.provider,
        description=m.description,
        is_active=m.is_active,
        is_custom=m.is_custom,
        created_at=m.created_at,
    )


@router.post("/{id}/activate")
def activate_model(
    id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mengubah model aktif yang digunakan untuk analisis struk."""
    target_model = db.query(AIModel).filter(AIModel.id == id).first()
    if not target_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model AI tidak ditemukan")

    # Nonaktifkan semua model lain
    db.query(AIModel).update({AIModel.is_active: False})
    target_model.is_active = True

    # Update app_settings
    setting = db.query(AppSetting).filter(AppSetting.key == "active_model_id").first()
    if setting:
        setting.value = target_model.model_id
    else:
        db.add(AppSetting(key="active_model_id", value=target_model.model_id, description="Model ID AI aktif"))

    db.commit()
    db.refresh(target_model)
    return {
        "message": f"Model '{target_model.name}' sekarang aktif digunakan.",
        "active_model": _to_ai_model_out(target_model),
    }


@router.post("", response_model=AIModelOut, status_code=status.HTTP_201_CREATED)
def create_custom_model(
    body: AIModelCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Menambahkan model AI baru secara manual (hanya Admin)."""
    exists = db.query(AIModel).filter(AIModel.model_id == body.model_id.strip()).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model ID '{body.model_id}' sudah terdaftar dalam sistem",
        )

    model = AIModel(
        name=body.name.strip(),
        model_id=body.model_id.strip(),
        provider=body.provider.strip(),
        description=body.description.strip() if body.description else None,
        is_active=False,
        is_custom=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _to_ai_model_out(model)


@router.put("/{id}", response_model=AIModelOut)
def update_model(
    id: int,
    body: AIModelUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Mengubah informasi model AI (hanya Admin)."""
    model = db.query(AIModel).filter(AIModel.id == id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model AI tidak ditemukan")

    if body.name is not None:
        model.name = body.name.strip()
    if body.model_id is not None:
        clean_id = body.model_id.strip()
        clash = db.query(AIModel).filter(AIModel.model_id == clean_id, AIModel.id != id).first()
        if clash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Model ID '{clean_id}' sudah digunakan")
        model.model_id = clean_id
    if body.provider is not None:
        model.provider = body.provider.strip()
    if body.description is not None:
        model.description = body.description.strip()

    db.commit()
    db.refresh(model)
    return _to_ai_model_out(model)


@router.delete("/{id}")
def delete_model(
    id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Menghapus model AI kustom (hanya Admin)."""
    model = db.query(AIModel).filter(AIModel.id == id).first()
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model AI tidak ditemukan")

    if model.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tidak dapat menghapus model yang sedang aktif. Silakan aktifkan model lain terlebih dahulu.",
        )

    db.delete(model)
    db.commit()
    return {"message": f"Model '{model.name}' berhasil dihapus"}


@router.post("/settings")
def update_ai_settings(
    body: AISettingsUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Menyimpan pengaturan API Key OpenRouter ke database (hanya Admin)."""
    if body.openrouter_api_key is not None:
        clean_key = body.openrouter_api_key.strip()
        setting = db.query(AppSetting).filter(AppSetting.key == "openrouter_api_key").first()
        if setting:
            setting.value = clean_key
        else:
            db.add(
                AppSetting(
                    key="openrouter_api_key",
                    value=clean_key,
                    description="API Key OpenRouter AI untuk ekstraksi struk",
                )
            )

    db.commit()
    return {"message": "Pengaturan AI berhasil disimpan ke database"}


@router.post("/test", response_model=AITestResponse)
def test_connection_endpoint(
    body: AITestRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Menguji koneksi ke OpenRouter dengan API key dan model yang dipilih (hanya Admin)."""
    api_key = body.api_key
    if not api_key:
        key_setting = db.query(AppSetting).filter(AppSetting.key == "openrouter_api_key").first()
        api_key = key_setting.value if key_setting and key_setting.value else ""

    model_id = body.model_id
    if not model_id:
        active_row = db.query(AIModel).filter(AIModel.is_active.is_(True)).first()
        model_id = active_row.model_id if active_row else "google/gemini-2.5-flash"

    result = test_ai_connection(api_key=api_key, model_id=model_id)
    return AITestResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        latency_ms=result.get("latency_ms"),
        model=result.get("model", model_id),
    )

