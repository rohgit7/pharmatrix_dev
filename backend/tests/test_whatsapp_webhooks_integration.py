import hashlib
import hmac
import json
from fastapi.testclient import TestClient

from app.main import app as test_app

client = TestClient(test_app)

from app.core.config import settings


def make_signature(body: bytes, secret: str) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def test_whatsapp_webhook_verification_success(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_VERIFY_TOKEN",
        "test-verify-token",
    )

    response = client.get(
        "/api/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "test-verify-token",
            "hub.challenge": "123456",
        },
    )

    assert response.status_code == 200
    assert response.json() == 123456


def test_whatsapp_webhook_verification_invalid_token(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_VERIFY_TOKEN",
        "test-verify-token",
    )

    response = client.get(
        "/api/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong-token",
            "hub.challenge": "123456",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Webhook verification failed"


def test_whatsapp_webhook_rejects_invalid_signature(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_APP_SECRET",
        "test-secret",
    )

    body = json.dumps(
        {
            "object": "whatsapp_business_account",
        }
    ).encode()

    response = client.post(
        "/api/webhooks/whatsapp",
        content=body,
        headers={
            "X-Hub-Signature-256": "sha256=invalid",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid webhook signature"


def test_whatsapp_webhook_rejects_invalid_json(monkeypatch):
    secret = "test-secret"

    monkeypatch.setattr(
        settings,
        "WHATSAPP_APP_SECRET",
        secret,
    )

    body = b"not-valid-json"

    response = client.post(
        "/api/webhooks/whatsapp",
        content=body,
        headers={
            "X-Hub-Signature-256": make_signature(
                body,
                secret,
            ),
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid JSON payload"