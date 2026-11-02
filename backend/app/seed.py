import logging
from sqlalchemy.orm import Session

from .config import settings
from .models import AIModel, AppSetting, Category, Currency, Transaction, User

log = logging.getLogger(__name__)

DEFAULT_ADMIN_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$2fBkZDgZODzLlYSUTB8aLA$RhF+Tng91CkJ92hRRapPjSKgleaoUDATvN4DCUbQbyU"
)

DEFAULT_EXPENSE_CATEGORIES = [
    "makanan",
    "transport",
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
    "lainnya",
]

DEFAULT_AI_MODELS = [
    {
        "name": "Google Gemini 2.5 Flash",
        "model_id": "google/gemini-2.5-flash",
        "provider": "OpenRouter",
        "description": "Rekomendasi utama: ekstraksi cepat, akurasi OCR struk tinggi, dan hemat biaya.",
        "is_active": True,
        "is_custom": False,
    },
    {
        "name": "Google Gemini 2.5 Flash Lite",
        "model_id": "google/gemini-2.5-flash-lite",
        "provider": "OpenRouter",
        "description": "Versi ringan berkecepatan tinggi dengan biaya token minimal.",
        "is_active": False,
        "is_custom": False,
    },
    {
        "name": "Google Gemini 2.5 Pro",
        "model_id": "google/gemini-2.5-pro",
        "provider": "OpenRouter",
        "description": "Model penalaran tinggi untuk struk kompleks, tabel panjang, atau gambar buram.",
        "is_active": False,
        "is_custom": False,
    },
    {
        "name": "OpenAI GPT-4o Mini",
        "model_id": "openai/gpt-4o-mini",
        "provider": "OpenRouter",
        "description": "Model multimodal cerdas & cepat dari OpenAI dengan OCR andal.",
        "is_active": False,
        "is_custom": False,
    },
    {
        "name": "OpenAI GPT-4o",
        "model_id": "openai/gpt-4o",
        "provider": "OpenRouter",
        "description": "Model unggulan multimodal OpenAI dengan akurasi pengenalan teks tinggi.",
        "is_active": False,
        "is_custom": False,
    },
    {
        "name": "Anthropic Claude 3.5 Sonnet",
        "model_id": "anthropic/claude-3.5-sonnet",
        "provider": "OpenRouter",
        "description": "Kemampuan pemahaman visual tingkat lanjut dan struktur dokumen finansial.",
        "is_active": False,
        "is_custom": False,
    },
    {
        "name": "Qwen 2.5 VL 72B Instruct",
        "model_id": "qwen/qwen-2.5-vl-72b-instruct",
        "provider": "OpenRouter",
        "description": "Model vision open-source terbaik untuk OCR multibahasa dan detail nota.",
        "is_active": False,
        "is_custom": False,
    },
]


def seed_all(db: Session):
    """Seed data awal: Currency IDR, default Categories, User Admin, dan Model AI."""
    # 1. Currency IDR
    idr = db.query(Currency).filter(Currency.code == "IDR").first()
    if not idr:
        log.info("Seeding default currency: IDR")
        idr = Currency(
            code="IDR",
            name="Rupiah Indonesia",
            symbol="Rp",
            decimal_places=0,
            is_active=True,
        )
        db.add(idr)
        db.commit()

    # 2. Initial Admin User
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        log.info("Seeding initial admin user: admin")
        admin = User(
            username="admin",
            password_hash=DEFAULT_ADMIN_PASSWORD_HASH,
            name="Administrator",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    # 3. Categories for Admin (Migrate legacy orphan categories & seed default admin categories)
    if admin:
        # Migrasi kategori lama yang belum memiliki user_id agar dimiliki admin tanpa melanggar unique constraint
        orphan_cats = db.query(Category).filter(Category.user_id.is_(None)).all()
        for o_cat in orphan_cats:
            clean_name = o_cat.name.strip().lower()
            existing_admin_cat = (
                db.query(Category)
                .filter(
                    Category.user_id == admin.id,
                    Category.type == o_cat.type,
                    Category.name == clean_name,
                )
                .first()
            )
            if existing_admin_cat:
                # Re-link transaksi yang memakai orphan category ke kategori admin
                db.query(Transaction).filter(Transaction.category_id == o_cat.id).update(
                    {"category_id": existing_admin_cat.id}, synchronize_session=False
                )
                db.delete(o_cat)
            else:
                o_cat.user_id = admin.id
                o_cat.name = clean_name

        db.commit()

        existing_categories = {
            (c.type, c.name.lower())
            for c in db.query(Category).filter(Category.user_id == admin.id).all()
        }

        for cat_name in DEFAULT_EXPENSE_CATEGORIES:
            if ("expense", cat_name.lower()) not in existing_categories:
                log.info("Seeding expense category for admin: %s", cat_name)
                db.add(Category(name=cat_name.lower(), type="expense", user_id=admin.id, is_active=True))

        for cat_name in DEFAULT_INCOME_CATEGORIES:
            if ("income", cat_name.lower()) not in existing_categories:
                log.info("Seeding income category for admin: %s", cat_name)
                db.add(Category(name=cat_name.lower(), type="income", user_id=admin.id, is_active=True))

        db.commit()

    # 4. AI Models & Settings
    existing_models = {m.model_id: m for m in db.query(AIModel).all()}
    active_found = any(m.is_active for m in existing_models.values())

    for m_def in DEFAULT_AI_MODELS:
        if m_def["model_id"] not in existing_models:
            log.info("Seeding AI model: %s", m_def["name"])
            is_act = m_def["is_active"] and not active_found
            if is_act:
                active_found = True
            db.add(
                AIModel(
                    name=m_def["name"],
                    model_id=m_def["model_id"],
                    provider=m_def["provider"],
                    description=m_def["description"],
                    is_active=is_act,
                    is_custom=m_def["is_custom"],
                )
            )

    # Pastikan minimal ada 1 model aktif
    if not active_found:
        flash_model = db.query(AIModel).filter(AIModel.model_id == "google/gemini-2.5-flash").first()
        if flash_model:
            flash_model.is_active = True

    # 5. App Settings (API Keys, Active Model, Limits, Storage)
    settings_seeds = [
        ("openrouter_api_key", settings.openrouter_api_key or "", "API Key OpenRouter AI untuk ekstraksi struk"),
        ("active_model_id", "google/gemini-2.5-flash", "Model ID AI aktif yang digunakan"),
        ("ai_daily_limit_per_user", "20", "Batas harian analisis struk AI per pengguna"),
        ("upload_dir", "uploads", "Folder penyimpanan file bukti unggahan"),
        ("max_upload_mb", "5", "Maksimal ukuran unggahan file dalam MB"),
    ]

    for key, val, desc in settings_seeds:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not row:
            db.add(AppSetting(key=key, value=val, description=desc))

    db.commit()


