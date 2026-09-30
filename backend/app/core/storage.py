from supabase import create_client, Client

from app.core.config import settings
from app.core.supabase_admin import get_supabase_admin


def create_signed_storage_url(
    storage_path: str,
    expires_in: int = 3600,
) -> str:
    supabase = get_supabase_admin()

    response = (
        supabase.storage
        .from_(settings.SUPABASE_PICKUP_PROOF_BUCKET)
        .create_signed_url(
            storage_path,
            expires_in,
        )
    )

    if not response:
        raise RuntimeError(
            "Unable to create signed storage URL"
        )

    if isinstance(response, dict):
        signed_url = response.get("signedURL")

        if not signed_url:
            signed_url = response.get("signedUrl")

        if signed_url:
            return signed_url

    raise RuntimeError(
        "Supabase did not return a signed URL"
    )


supabase_storage: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SECRET_KEY,
)