from sqlalchemy import select
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.enums import NotificationChannel, NotificationStatus
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_dispatcher import NotificationDispatcher
from app.models.customer import Customer
from app.notifications.phone import normalize_phone_number
from app.services.whatsapp_template_service import (
    build_template_parameters,
    get_template_for_notification,
)

def process_pending_notifications(
    batch_size: int = 10,
) -> int:

    db = SessionLocal()
    dispatcher = NotificationDispatcher()

    processed = 0

    try:
        notifications = db.scalars(
            select(Notification)
            .where(
                Notification.status == NotificationStatus.PENDING,
                Notification.channel != NotificationChannel.IN_APP,
            )
            .order_by(Notification.created_at)
            .limit(batch_size)
            .with_for_update(skip_locked=True)
        ).all()

        for notification in notifications:

            try:
                user = db.get(User, notification.user_id)

                if not user:
                    notification.status = NotificationStatus.FAILED
                    notification.failure_reason = (
                        f"User {notification.user_id} not found"
                    )
                    continue

                # ---------------------------------
                # Resolve recipient
                # ---------------------------------

                if notification.channel == NotificationChannel.EMAIL:

                    if not user.email:
                        notification.status = NotificationStatus.FAILED
                        notification.failure_reason = (
                            "User does not have an email address"
                        )
                        continue

                    recipient = user.email

                elif notification.channel == NotificationChannel.WHATSAPP:

                    customer = db.scalar(
                        select(Customer).where(
                            Customer.user_id == notification.user_id
                        )
                    )

                    if not customer:
                        notification.status = NotificationStatus.FAILED
                        notification.failure_reason = (
                            "Customer record not found for notification user"
                        )
                        continue

                    try:
                        recipient = normalize_phone_number(customer.phone)

                        template = get_template_for_notification(
                            db,
                            notification.type,
                        )

                        if not template:
                            notification.status = NotificationStatus.FAILED
                            notification.failure_reason = (
                                f"No active WhatsApp template configured "
                                f"for {notification.type.value}"
                            )
                            continue

                        metadata = notification.notification_metadata or {}

                        parameters = build_template_parameters(
                            template,
                            metadata,
                        )

                        provider_metadata = {
                            "meta_template_name": template.meta_template_name,
                            "language_code": template.language_code,
                            "parameters": parameters,
                        }

                        message_id = provider.send(
                            recipient=recipient,
                            title=notification.title,
                            body=notification.body,
                            metadata=provider_metadata,
                        )

                        notification.provider_message_id = message_id
                        notification.status = NotificationStatus.SENT

                    except Exception as exc:
                        notification.status = NotificationStatus.FAILED
                        notification.failure_reason = str(exc)

                else:
                    notification.status = NotificationStatus.FAILED
                    notification.failure_reason = (
                        f"Unsupported notification channel: "
                        f"{notification.channel}"
                        )
                    continue

                # ---------------------------------
                # Send notification
                # ---------------------------------

                provider_message_id = dispatcher.send(
                    channel=notification.channel,
                    recipient=recipient,
                    title=notification.title,
                    body=notification.body,
                )

                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.now(timezone.utc)
                notification.provider_message_id = provider_message_id

                processed += 1

            except Exception as exc:

                notification.status = NotificationStatus.FAILED
                notification.failure_reason = str(exc)

        db.commit()
        return processed

    finally:
        db.close()