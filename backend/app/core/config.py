from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator

class Settings(BaseSettings):
    APP_NAME: str = "Pharmatrix"
    APP_ENV: str = "development"
    DEBUG: bool = False

    DATABASE_URL: str

    SUPABASE_URL: str
    SUPABASE_PUBLISHABLE_KEY: str
    SUPABASE_SECRET_KEY: str

    SUPABASE_STORAGE_BUCKET: str = "customer-documents"
    SUPABASE_PICKUP_PROOF_BUCKET: str = "pickup-proofs"
    SUPABASE_DISPOSAL_CERTIFICATE_BUCKET: str = "disposal-certificates"

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    OSRM_BASE_URL: str | None = None

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "Pharmatrix"
    SMTP_USE_TLS: bool = True

    RAZORPAY_KEY_ID: str | None = None
    RAZORPAY_KEY_SECRET: str | None = None
    RAZORPAY_WEBHOOK_SECRET: str | None = None
    RAZORPAY_CURRENCY: str = "INR"

    WHATSAPP_PROVIDER: str | None = None
    WHATSAPP_API_URL: str | None = None
    WHATSAPP_ACCESS_TOKEN: str | None = None
    WHATSAPP_PHONE_NUMBER_ID: str | None = None
    WHATSAPP_WABA_ID: str | None = None
    WHATSAPP_VERIFY_TOKEN: str | None = None
    WHATSAPP_APP_SECRET: str | None = None
    WHATSAPP_GRAPH_VERSION: str = "v23.0"

    CORS_ORIGINS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.APP_ENV.lower() == "production":
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")

            if not self.CORS_ORIGINS.strip():
                raise ValueError(
                    "CORS_ORIGINS must be configured in production"
                )

            if "*" in [
                origin.strip()
                for origin in self.CORS_ORIGINS.split(",")
            ]:
                raise ValueError(
                    "Wildcard CORS origins are not allowed in production"
                )

        return self


settings = Settings()