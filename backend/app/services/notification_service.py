from datetime import datetime, timezone
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationType,
)
from app.models.notification import Notification
from app.notifications.expo_push import ExpoPushProvider, is_valid_expo_push_token

logger = logging.getLogger(__name__)


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


def register_device_token(
    db: Session,
    *,
    user_id: int,
    expo_push_token: str,
    device_platform: str = "android",
    device_name: str | None = None,
) -> DeviceToken:
    """
    Registers or updates an Expo push device token for the user.
    If the same token was previously assigned to another user,
    it is deactivated for that user and reassigned to this user.
    """
    token_str = expo_push_token.strip()
    if not is_valid_expo_push_token(token_str):
        raise ValueError(f"Invalid Expo push token format: {token_str}")

    now = datetime.now(timezone.utc)

    # Deactivate any registrations of this token by other users
    other_tokens = db.scalars(
        select(DeviceToken).where(
            DeviceToken.expo_push_token == token_str,
            DeviceToken.user_id != user_id,
        )
    ).all()
    for ot in other_tokens:
        ot.is_active = False
        ot.updated_at = now

    existing = db.scalar(
        select(DeviceToken).where(
            DeviceToken.user_id == user_id,
            DeviceToken.expo_push_token == token_str,
        )
    )

    if existing:
        existing.is_active = True
        existing.device_platform = device_platform.lower()
        if device_name:
            existing.device_name = device_name
        existing.updated_at = now
        db.flush()
        return existing

    device = DeviceToken(
        user_id=user_id,
        expo_push_token=token_str,
        device_platform=device_platform.lower(),
        device_name=device_name,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(device)
    db.flush()
    return device


def deactivate_device_token(
    db: Session,
    *,
    user_id: int,
    expo_push_token: str,
) -> bool:
    """
    Deactivates an active device token when a user logs out.
    """
    token_str = expo_push_token.strip()
    device = db.scalar(
        select(DeviceToken).where(
            DeviceToken.user_id == user_id,
            DeviceToken.expo_push_token == token_str,
        )
    )
    if device:
        device.is_active = False
        device.updated_at = datetime.now(timezone.utc)
        db.flush()
        return True
    return False


def get_active_device_tokens(
    db: Session,
    user_id: int,
) -> list[DeviceToken]:
    return list(
        db.scalars(
            select(DeviceToken).where(
                DeviceToken.user_id == user_id,
                DeviceToken.is_active.is_(True),
            )
        ).all()
    )


def send_push_notification_to_user(
    db: Session,
    *,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    body: str,
    event_key: str,
    channel_id: str = "pickup_updates",
    metadata: dict | None = None,
) -> int:
    """
    Creates an IN_APP notification record and dispatches native push notifications
    to all active registered devices for the given user.

    Safety: Notification delivery failures never raise or rollback transaction.
    Invalid or unregistered tokens are automatically marked inactive.
    """
    meta = dict(metadata or {})

    # 1. Ensure IN_APP notification record exists for in-app history
    try:
        create_notification(
            db,
            user_id=user_id,
            notification_type=notification_type,
            channel=NotificationChannel.IN_APP,
            title=title,
            body=body,
            event_key=event_key,
            metadata=meta,
        )
    except Exception as exc:
        logger.warning("Failed to record IN_APP notification for user %d: %s", user_id, exc)

    # 2. Query active devices
    try:
        devices = get_active_device_tokens(db, user_id)
    except Exception as exc:
        logger.warning("Failed to query active devices for user %d: %s", user_id, exc)
        return 0

    if not devices:
        return 0

    push_provider = ExpoPushProvider()
    successful_deliveries = 0

    for device in devices:
        token = device.expo_push_token
        if not is_valid_expo_push_token(token):
            device.is_active = False
            continue

        push_meta = dict(meta)
        push_meta["channel_id"] = channel_id
        push_meta["notification_type"] = notification_type.value
        push_meta["title"] = title
        push_meta["body"] = body

        device_event_key = f"{event_key}:{device.id}"

        # Record PUSH notification attempt
        push_record = create_notification(
            db,
            user_id=user_id,
            notification_type=notification_type,
            channel=NotificationChannel.PUSH,
            title=title,
            body=body,
            event_key=device_event_key,
            metadata=push_meta,
        )

        try:
            ticket_id = push_provider.send(
                recipient=token,
                title=title,
                body=body,
                metadata=push_meta,
            )

            if ticket_id:
                mark_notification_sent(db, push_record, provider_message_id=ticket_id)
                successful_deliveries += 1
            else:
                mark_notification_failed(db, push_record, reason="Push provider returned no ticket ID")
        except Exception as exc:
            err_msg = str(exc)
            mark_notification_failed(db, push_record, reason=err_msg)
            if "DeviceNotRegistered" in err_msg:
                device.is_active = False
                device.updated_at = datetime.now(timezone.utc)
                logger.info("Deactivated unregistered token %s for user %d", token, user_id)

    try:
        db.flush()
    except Exception as exc:
        logger.warning("Failed to flush push notification state: %s", exc)

    return successful_deliveries
