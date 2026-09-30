import hashlib
import hmac
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.services.whatsapp_webhook_service import (
    process_whatsapp_webhook,
)

router = APIRouter(
    prefix="/api/webhooks/whatsapp",
    tags=["WhatsApp Webhooks"],
)


@router.get("")
async def verify_whatsapp_webhook(
    request: Request,
):
    params = request.query_params

    mode = params.get("hub.mode")
    verify_token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if (
        mode == "subscribe"
        and settings.WHATSAPP_VERIFY_TOKEN
        and hmac.compare_digest(
            verify_token or "",
            settings.WHATSAPP_VERIFY_TOKEN,
        )
    ):
        return int(challenge)

    raise HTTPException(
        status_code=403,
        detail="Webhook verification failed",
    )


def _verify_signature(
    body: bytes,
    signature: str | None,
) -> bool:

    if not settings.WHATSAPP_APP_SECRET:
        return False

    if not signature:
        return False

    if not signature.startswith("sha256="):
        return False

    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    received = signature.removeprefix("sha256=")

    return hmac.compare_digest(
        expected,
        received,
    )


@router.post("")
async def receive_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    body = await request.body()

    signature = request.headers.get(
        "X-Hub-Signature-256"
    )

    if not _verify_signature(
        body,
        signature,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook signature",
        )

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON payload",
        )

    process_whatsapp_webhook(
        db=db,
        payload=payload,
    )

    db.commit()

    return {
        "status": "ok",
    }