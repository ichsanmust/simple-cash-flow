from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        extra="ignore"
    )

    database_url: str = "sqlite:///./cashflow.db"
    jwt_secret: str = "2N_e-EAbwryHpdH2kO3G6ClyK92Ka1eDpTU1YmrJegsbkd7afIDo12xhLGdmrReE"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    openrouter_api_key: str = ""
    gemini_api_key: str = ""
    ai_daily_limit_per_user: int = 20

    upload_dir: str = "uploads"
    max_upload_mb: int = 5


settings = Settings()

