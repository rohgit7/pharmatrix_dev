import httpx

from app.core.config import settings
from app.notifications.base import NotificationProvider


class WhatsAppProvider(NotificationProvider):

    def send(
        self,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:

        if not settings.WHATSAPP_ACCESS_TOKEN:
            raise RuntimeError(
                "WHATSAPP_ACCESS_TOKEN is not configured."
            )

        if not settings.WHATSAPP_PHONE_NUMBER_ID:
            raise RuntimeError(
                "WHATSAPP_PHONE_NUMBER_ID is not configured."
            )

        metadata = metadata or {}

        template_name = metadata.get("meta_template_name")
        language_code = metadata.get(
            "language_code",
            "en_US",
        )
        parameters = metadata.get(
            "parameters",
            [],
        )

        if not template_name:
            raise RuntimeError(
                "WhatsApp template name is missing."
            )

        url = (
            f"{settings.WHATSAPP_API_URL.rstrip('/')}"
            f"/{settings.WHATSAPP_GRAPH_VERSION}"
            f"/{settings.WHATSAPP_PHONE_NUMBER_ID}"
            "/messages"
        )

        template = {
            "name": template_name,
            "language": {
                "code": language_code,
            },
        }

        if parameters:
            template["components"] = [
                {
                    "type": "body",
                    "parameters": parameters,
                }
            ]

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient,
            "type": "template",
            "template": template,
        }

        headers = {
            "Authorization": (
                f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"
            ),
            "Content-Type": "application/json",
        }

        try:
            response = httpx.post(
                url,
                json=payload,
                headers=headers,
                timeout=30.0,
            )
        except httpx.HTTPError as exc:
            raise RuntimeError(
                f"WhatsApp request failed: {exc}"
            ) from exc

        if response.is_error:
            try:
                error_data = response.json()
                error_message = (
                    error_data
                    .get("error", {})
                    .get("message")
                    or str(error_data)
                )
            except ValueError:
                error_message = response.text

            raise RuntimeError(
                f"Meta WhatsApp API error: {error_message}"
            )

        data = response.json()

        messages = data.get("messages")

        if not messages or not messages[0].get("id"):
            raise RuntimeError(
                "Meta WhatsApp API did not return a message ID."
            )

        return messages[0]["id"]