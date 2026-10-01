from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationType,
)
from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: NotificationType,
    channel: NotificationChannel,
    title: str,
    body: str,
    event_key: str,
    metadata: dict | None = None,
) -> Notification:

    existing = db.scalar(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.channel == channel,
            Notification.event_key == event_key,
        )
    )

    if existing:
        return existing

    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        channel=channel,
        status=NotificationStatus.PENDING,
        title=title,
        body=body,
        event_key=event_key,
        notification_metadata=metadata,
    )

    db.add(notification)
    db.flush()

    return notification


def mark_notification_sent(
    db: Session,
    notification: Notification,
    provider_message_id: str | None = None,
):
    notification.status = NotificationStatus.SENT
    notification.sent_at = datetime.now(timezone.utc)
    notification.provider_message_id = provider_message_id

    db.flush()


def mark_notification_failed(
    db: Session,
    notification: Notification,
    reason: str,
):
    notification.status = NotificationStatus.FAILED
    notification.failure_reason = reason

    db.flush()


def mark_notification_read(
    db: Session,
    notification: Notification,
):
    notification.read_at = datetime.now(timezone.utc)
    db.flush()