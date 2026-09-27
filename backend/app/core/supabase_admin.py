from supabase import create_client, Client

from app.core.config import settings


def get_supabase_admin() -> Client:
    if not settings.SUPABASE_SECRET_KEY:
        raise RuntimeError("SUPABASE_SECRET_KEY is not configured")

    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SECRET_KEY,
    )