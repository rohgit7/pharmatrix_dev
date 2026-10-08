import httpx
import pytest

from app.core.config import settings
from app.notifications.whatsapp import WhatsAppProvider


def test_missing_access_token(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", None)
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "phone-id")

    with pytest.raises(
        RuntimeError,
        match="WHATSAPP_ACCESS_TOKEN is not configured",
    ):
        WhatsAppProvider().send(
            recipient="919999999999",
            title="Test",
            body="Test",
            metadata={"meta_template_name": "test_template"},
        )


def test_missing_phone_number_id(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_ACCESS_TOKEN",
        "test-token",
    )
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", None)

    with pytest.raises(
        RuntimeError,
        match="WHATSAPP_PHONE_NUMBER_ID is not configured",
    ):
        WhatsAppProvider().send(
            recipient="919999999999",
            title="Test",
            body="Test",
            metadata={"meta_template_name": "test_template"},
        )


def test_missing_template_name(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_ACCESS_TOKEN",
        "test-token",
    )
    monkeypatch.setattr(
        settings,
        "WHATSAPP_PHONE_NUMBER_ID",
        "phone-id",
    )

    with pytest.raises(
        RuntimeError,
        match="WhatsApp template name is missing",
    ):
        WhatsAppProvider().send(
            recipient="919999999999",
            title="Test",
            body="Test",
        )


def test_successful_whatsapp_send(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_ACCESS_TOKEN",
        "test-token",
    )
    monkeypatch.setattr(
        settings,
        "WHATSAPP_PHONE_NUMBER_ID",
        "phone-id",
    )
    monkeypatch.setattr(
        settings,
        "WHATSAPP_API_URL",
        "https://graph.facebook.com",
    )
    monkeypatch.setattr(
        settings,
        "WHATSAPP_GRAPH_VERSION",
        "v23.0",
    )

    def mock_post(url, json, headers, timeout):
        assert url == (
            "https://graph.facebook.com/"
            "v23.0/phone-id/messages"
        )

        assert json["messaging_product"] == "whatsapp"
        assert json["to"] == "919999999999"
        assert json["type"] == "template"
        assert json["template"]["name"] == "pickup_update"
        assert json["template"]["language"]["code"] == "en_US"
        assert json["template"]["components"][0]["parameters"] == [
            {"type": "text", "text": "Rohan"}
        ]

        assert headers["Authorization"] == "Bearer test-token"

        return httpx.Response(
            200,
            json={"messages": [{"id": "wamid.test123"}]},
        )

    monkeypatch.setattr(httpx, "post", mock_post)

    result = WhatsAppProvider().send(
        recipient="919999999999",
        title="Pickup Update",
        body="Pickup scheduled",
        metadata={
            "meta_template_name": "pickup_update",
            "language_code": "en_US",
            "parameters": [
                {"type": "text", "text": "Rohan"}
            ],
        },
    )

    assert result == "wamid.test123"


def test_whatsapp_api_error(monkeypatch):
    monkeypatch.setattr(
        settings,
        "WHATSAPP_ACCESS_TOKEN",
        "test-token",
    )
    monkeypatch.setattr(
        settings,
        "WHATSAPP_PHONE_NUMBER_ID",
        "phone-id",
    )

    def mock_post(*args, **kwargs):
        return httpx.Response(
            400,
            json={
                "error": {
                    "message": "Invalid OAuth access token"
                }
            },
        )

    monkeypatch.setattr(httpx, "post", mock_post)

    with pytest.raises(
        RuntimeError,
        match="Meta WhatsApp API error: Invalid OAuth access token",
    ):
        WhatsAppProvider().send(
            recipient="919999999999",
            title="Test",
            body="Test",
            metadata={"meta_template_name": "test_template"},
        )