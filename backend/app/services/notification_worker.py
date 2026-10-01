from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
)
from app.models.notification import Notification
from app.models.user import User
from app.notifications.phone import normalize_phone_number
from app.services.configuration_runtime_service import (
    get_configuration_bool,
)
from app.services.notification_dispatcher import NotificationDispatcher
from app.services.whatsapp_template_service import (
    build_template_parameters,
    get_template_for_notification,
)


PROCESSING_TIMEOUT_MINUTES = 10
MAX_NOTIFICATION_ATTEMPTS = 5
RETRY_DELAY_SECONDS = 60


def _recover_stuck_notifications(
    db,
    now: datetime,
) -> int:
    processing_cutoff = (
        now
        - timedelta(
            minutes=PROCESSING_TIMEOUT_MINUTES
        )
    )

    stuck_notifications = db.scalars(
        select(Notification)
        .where(
            Notification.status
            == NotificationStatus.PROCESSING,
            Notification.processing_started_at.is_not(None),
            Notification.processing_started_at
            <= processing_cutoff,
        )
        .with_for_update(skip_locked=True)
    ).all()

    recovered = 0

    for notification in stuck_notifications:

        if (
            notification.attempt_count
            >= MAX_NOTIFICATION_ATTEMPTS
        ):
            notification.status = (
                NotificationStatus.FAILED
            )
            notification.failure_reason = (
                "Notification processing timed out "
                "after the maximum number of attempts"
            )
            notification.processing_started_at = None

        else:
            notification.status = (
                NotificationStatus.PENDING
            )
            notification.failure_reason = (
                "Previous notification processing "
                "attempt timed out; retrying"
            )
            notification.processing_started_at = None

        recovered += 1

    return recovered


def _claim_pending_notifications(
    db,
    batch_size: int,
    now: datetime,
    enabled_channels: list[NotificationChannel],
) -> list[Notification]:
    retry_cutoff = (
        now
        - timedelta(
            seconds=RETRY_DELAY_SECONDS
        )
    )

    notifications = db.scalars(
        select(Notification)
        .where(
            Notification.status
            == NotificationStatus.PENDING,
            (
                Notification.last_attempt_at.is_(None)
                | (
                    Notification.last_attempt_at
                    <= retry_cutoff
                )
            ),
            Notification.channel.in_(enabled_channels),
        )
        .order_by(Notification.created_at)
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    ).all()

    for notification in notifications:
        notification.status = (
            NotificationStatus.PROCESSING
        )
        notification.processing_started_at = now
        notification.last_attempt_at = now
        notification.attempt_count += 1

    db.commit()

    return notifications


def _mark_retry_or_failed(
    db,
    notification: Notification,
    reason: str,
) -> None:
    notification.processing_started_at = None
    notification.failure_reason = reason

    if (
        notification.attempt_count
        >= MAX_NOTIFICATION_ATTEMPTS
    ):
        notification.status = (
            NotificationStatus.FAILED
        )
    else:
        notification.status = (
            NotificationStatus.PENDING
        )

    db.commit()


def process_pending_notifications(
    batch_size: int = 10,
) -> int:

    db = SessionLocal()
    dispatcher = NotificationDispatcher()

    processed = 0

    try:
        email_enabled = get_configuration_bool(
            db,
            "notifications.email_enabled",
        )

        whatsapp_enabled = get_configuration_bool(
            db,
            "notifications.whatsapp_enabled",
        )

        enabled_channels = []

        if email_enabled:
            enabled_channels.append(
                NotificationChannel.EMAIL
            )

        if whatsapp_enabled:
            enabled_channels.append(
                NotificationChannel.WHATSAPP
            )

        if not enabled_channels:
            return 0

        worker_now = datetime.now(timezone.utc)

        _recover_stuck_notifications(
            db,
            worker_now,
        )

        notifications = _claim_pending_notifications(
            db=db,
            batch_size=batch_size,
            now=worker_now,
            enabled_channels=enabled_channels,
        )

        for notification in notifications:

            try:
                user = db.get(
                    User,
                    notification.user_id,
                )

                if not user:
                    raise ValueError(
                        f"User {notification.user_id} not found"
                    )

                recipient = None
                provider_metadata = None

                # -----------------------------------------
                # Resolve recipient
                # -----------------------------------------

                if (
                    notification.channel
                    == NotificationChannel.EMAIL
                ):

                    if not user.email:
                        raise ValueError(
                            "User does not have an email address"
                        )

                    recipient = user.email

                elif (
                    notification.channel
                    == NotificationChannel.WHATSAPP
                ):

                    customer = db.scalar(
                        select(Customer).where(
                            Customer.user_id
                            == notification.user_id
                        )
                    )

                    if not customer:
                        raise ValueError(
                            "Customer record not found "
                            "for notification user"
                        )

                    recipient = normalize_phone_number(
                        customer.phone
                    )

                    template = (
                        get_template_for_notification(
                            db,
                            notification.notification_type,
                        )
                    )

                    if not template:
                        raise ValueError(
                            "No active WhatsApp template "
                            "configured for "
                            f"{notification.notification_type.value}"
                        )

                    metadata = (
                        notification.notification_metadata
                        or {}
                    )

                    parameters = (
                        build_template_parameters(
                            template,
                            metadata,
                        )
                    )

                    provider_metadata = {
                        "meta_template_name": (
                            template.meta_template_name
                        ),
                        "language_code": (
                            template.language_code
                        ),
                        "parameters": parameters,
                    }

                else:
                    raise ValueError(
                        "Unsupported notification channel: "
                        f"{notification.channel}"
                    )

                # -----------------------------------------
                # External delivery
                # -----------------------------------------

                provider_message_id = (
                    dispatcher.send(
                        channel=notification.channel,
                        recipient=recipient,
                        title=notification.title,
                        body=notification.body,
                        metadata=provider_metadata,
                    )
                )

                # -----------------------------------------
                # Successful delivery
                # -----------------------------------------

                notification.status = (
                    NotificationStatus.SENT
                )
                notification.sent_at = (
                    datetime.now(timezone.utc)
                )
                notification.provider_message_id = (
                    provider_message_id
                )
                notification.processing_started_at = None
                notification.failure_reason = None

                db.commit()

                processed += 1

            except Exception as exc:

                _mark_retry_or_failed(
                    db,
                    notification,
                    str(exc),
                )

        return processed

    finally:
        db.close()