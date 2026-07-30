from functools import lru_cache
from uuid import UUID

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    app_name: str = "KhataFlow API"
    environment: str = "development"
    mongodb_uri: str | None = None
    mongodb_database: str = "khataflow"
    jwt_secret: str = "change-this-development-secret-before-deploying"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    whisper_model: str = "base"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    default_business_id: UUID = UUID("00000000-0000-0000-0000-000000000001")
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    password_reset_minutes: int = 30
    verification_token_days: int = 2
    rate_limit_per_minute: int = 120
    public_web_url: str = "http://localhost:5173"
    upi_id: str | None = None
    business_upi_name: str = "KhataFlow Business"
    business_whatsapp: str | None = None
    # Twilio WhatsApp automatic sending
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_whatsapp_from: str = "whatsapp:+14155238886"
    # SMTP
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def twilio_enabled(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_development(self) -> bool:
        return self.environment.casefold() == "development"

    @property
    def effective_llm_key(self) -> str | None:
        return self.groq_api_key or self.openai_api_key

    @property
    def effective_llm_model(self) -> str:
        if self.groq_api_key:
            return self.groq_model
        return self.openai_model

    @property
    def effective_llm_base(self) -> str | None:
        if self.groq_api_key:
            return self.llm_base_url
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
