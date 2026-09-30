from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.enums import NotificationStatus


STATUS_PRIORITY = {
    "sent": 10,
    "delivered": 20,
    "read": 30,
    "failed": 100,
    "deleted": 100,
}


def _should_update(current: str | None, incoming: str) -> bool:
    if not current:
        return True

    current_priority = STATUS_PRIORITY.get(current, 0)
    incoming_priority = STATUS_PRIORITY.get(incoming, 0)

    return incoming_priority >= current_priority


def _timestamp_to_datetime(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)

    try:
        return datetime.fromtimestamp(
            int(value),
            tz=timezone.utc,
        )
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def process_whatsapp_webhook(
    db: Session,
    payload: dict,
) -> int:

    processed = 0

    if payload.get("object") != "whatsapp_business_account":
        return processed

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):

            if change.get("field") != "messages":
                continue

            value = change.get("value", {})

            for status_data in value.get("statuses", []):

                message_id = status_data.get("id")
                provider_status = status_data.get("status")

                if not message_id or not provider_status:
                    continue

                notification = db.scalar(
                    select(Notification)
                    .where(
                        Notification.provider_message_id
                        == message_id
                    )
                    .with_for_update()
                )

                if not notification:
                    continue

                if not _should_update(
                    notification.provider_status,
                    provider_status,
                ):
                    continue

                notification.provider_status = provider_status

                notification.provider_status_at = (
                    _timestamp_to_datetime(
                        status_data.get("timestamp")
                    )
                )

                if provider_status == "failed":

                    errors = status_data.get("errors")

                    notification.failure_reason = (
                        str(errors)
                        if errors
                        else "WhatsApp message delivery failed"
                    )

                    notification.status = (
                        NotificationStatus.FAILED
                    )

                elif provider_status in {
                    "sent",
                    "delivered",
                    "read",
                }:

                    if notification.status != NotificationStatus.FAILED:
                        notification.status = NotificationStatus.SENT

                processed += 1

    return processed