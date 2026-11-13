from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_recycle=settings.DB_POOL_RECYCLE,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def test_database_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        return result.scalar() == 1


_SCHEMA_ENSURED = False


def ensure_runtime_schema():
    global _SCHEMA_ENSURED
    if _SCHEMA_ENSURED:
        return

    if engine.dialect.name != "postgresql":
        _SCHEMA_ENSURED = True
        return

    from app.models.enums import NotificationChannel, NotificationType

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for ch in NotificationChannel:
            conn.execute(
                text(f"ALTER TYPE notificationchannel ADD VALUE IF NOT EXISTS '{ch.value}'")
            )
        for nt in NotificationType:
            conn.execute(
                text(f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{nt.value}'")
            )
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS device_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expo_push_token VARCHAR(255) NOT NULL,
                    device_platform VARCHAR(30) NOT NULL DEFAULT 'android',
                    device_name VARCHAR(100),
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_device_token_user_expo UNIQUE (user_id, expo_push_token)
                )
                """
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens (user_id)")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_device_tokens_expo_push_token ON device_tokens (expo_push_token)")
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_device_tokens_is_active ON device_tokens (is_active)")
        )
        conn.execute(
            text("ALTER TABLE customer_locations ALTER COLUMN latitude DROP NOT NULL")
        )
        conn.execute(
            text("ALTER TABLE customer_locations ALTER COLUMN longitude DROP NOT NULL")
        )

    _SCHEMA_ENSURED = True
