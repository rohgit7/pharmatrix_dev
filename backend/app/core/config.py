from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Pharmatrix"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str

    SUPABASE_URL: str
    SUPABASE_PUBLISHABLE_KEY: str
    SUPABASE_SECRET_KEY: str
    SUPABASE_STORAGE_BUCKET: str = "customer-documents"  

    OSRM_BASE_URL: str = "http://localhost:5000"

    CORS_ORIGINS: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()