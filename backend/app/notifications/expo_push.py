import json
import logging
import re
import urllib.error
import urllib.request
from typing import Any

from app.notifications.base import NotificationProvider

logger = logging.getLogger(__name__)

EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_TOKEN_PATTERN = re.compile(
    r"^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_\-\.\/+=]+\]$"
)


def is_valid_expo_push_token(token: str) -> bool:
    if not isinstance(token, str):
        return False
    token = token.strip()
    return bool(EXPO_PUSH_TOKEN_PATTERN.match(token))


class ExpoPushProvider(NotificationProvider):
    """
    Provider for sending push notifications through the Expo Push Notification Service.
    """

    def __init__(self, api_url: str = EXPO_PUSH_API_URL):
        self.api_url = api_url

    def send(
        self,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:
        """
        Sends a single push notification to the given Expo push token recipient.
        Returns the Expo ticket ID or None if delivery failed.
        """
        if not is_valid_expo_push_token(recipient):
            logger.warning("Invalid Expo push token: %s", recipient)
            return None

        meta = dict(metadata or {})
        channel_id = meta.pop("channel_id", "default")
        sound = meta.pop("sound", "default")
        priority = meta.pop("priority", "high")

        payload = {
            "to": recipient.strip(),
            "sound": sound,
            "title": title,
            "body": body,
            "data": meta,
            "channelId": channel_id,
            "priority": priority,
        }

        results = self.send_batch([payload])
        if results and len(results) > 0:
            result = results[0]
            if result.get("status") == "ok":
                return result.get("id")
            else:
                logger.warning(
                    "Expo push notification failed for %s: %s (error: %s)",
                    recipient,
                    result.get("message"),
                    result.get("details", {}).get("error"),
                )
        return None

    def send_batch(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Sends a batch of notification payloads to the Expo Push API.
        Returns a list of receipt ticket dictionaries corresponding to each message.
        """
        if not messages:
            return []

        data = json.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            self.api_url,
            data=data,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                resp_data = response.read().decode("utf-8")
                parsed = json.loads(resp_data)
                return parsed.get("data", [])
        except urllib.error.HTTPError as exc:
            try:
                error_body = exc.read().decode("utf-8")
                error_json = json.loads(error_body)
                errors = error_json.get("errors", [])
                logger.error("Expo HTTPError %d: %s", exc.code, errors)
            except Exception:
                logger.error("Expo HTTPError %d: %s", exc.code, str(exc))
            return [{"status": "error", "message": f"HTTP {exc.code}"}] * len(messages)
        except Exception as exc:
            logger.error("Failed to connect to Expo Push API: %s", exc)
            return [{"status": "error", "message": str(exc)}] * len(messages)

