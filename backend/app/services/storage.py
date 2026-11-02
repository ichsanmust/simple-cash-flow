import hashlib
import os
from pathlib import Path
import uuid
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AppSetting

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
    "image/x-png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}

EXT_TO_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
}


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def get_storage_settings(db: Session | None = None) -> tuple[str, int]:
    """Mengambil (upload_dir, max_upload_mb) dari database app_settings dengan fallback ke default."""
    upload_dir = settings.upload_dir
    max_upload_mb = settings.max_upload_mb
    if db:
        dir_setting = db.query(AppSetting).filter(AppSetting.key == "upload_dir").first()
        if dir_setting and dir_setting.value and dir_setting.value.strip():
            upload_dir = dir_setting.value.strip()

        mb_setting = db.query(AppSetting).filter(AppSetting.key == "max_upload_mb").first()
        if mb_setting and mb_setting.value:
            try:
                max_upload_mb = int(mb_setting.value.strip())
            except ValueError:
                pass
    return upload_dir, max_upload_mb


async def save_upload_file(
    file: UploadFile,
    user_id: int,
    db: Session | None = None,
) -> tuple[str, str, str, str, bytes]:
    """
    Validasi dan simpan file ke folder uploads/<user_id>/<uuid>.<ext>.
    Return (relative_path, original_filename, mime_type, sha256_hash, file_bytes).
    """
    upload_dir, max_upload_mb = get_storage_settings(db)
    mime_type = (file.content_type or "").lower().strip()
    file_ext = Path(file.filename or "").suffix.lower()

    if mime_type not in ALLOWED_MIME_TYPES:
        if file_ext in EXT_TO_MIME:
            mime_type = EXT_TO_MIME[file_ext]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Format file tidak didukung: '{mime_type or file_ext}'. Hanya JPG, PNG, WEBP, dan PDF yang diperbolehkan.",
            )

    content = await file.read()
    max_bytes = max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ukuran file ({len(content) // 1024} KB) melebihi batas maksimal {max_upload_mb} MB.",
        )

    ext = ALLOWED_MIME_TYPES.get(mime_type, file_ext or ".jpg")
    file_id = f"{uuid.uuid4()}{ext}"
    user_upload_dir = Path(upload_dir) / str(user_id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)

    file_path = user_upload_dir / file_id
    with open(file_path, "wb") as f:
        f.write(content)

    sha256_hash = compute_sha256(content)
    relative_path = str(file_path)

    return relative_path, file.filename or "file", mime_type, sha256_hash, content


def remove_file(path_str: str | None):
    if not path_str:
        return
    try:
        if os.path.exists(path_str):
            os.remove(path_str)
    except Exception:
        pass

