from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal
from app.models.enums import (
    NotificationChannel,
    NotificationType,
    PickupStatus,
)
from app.models.pickup import Pickup
from app.services.configuration_runtime_service import (
    get_configuration_float,
)
from app.services.notification_service import create_notification


def process_pickup_reminders() -> int:
    db = SessionLocal()

    processed = 0

    try:
        reminder_hours = get_configuration_float(
            db,
            "notifications.pickup_reminder_hours",
        )

        now = datetime.now(timezone.utc)

        reminder_cutoff = (
            now + timedelta(hours=reminder_hours)
        )

        pickups = db.scalars(
            select(Pickup)
            .options(
                joinedload(Pickup.customer)
            )
            .where(
                Pickup.status == PickupStatus.SCHEDULED,
                Pickup.scheduled_date.is_not(None),
                Pickup.scheduled_date > now,
                Pickup.scheduled_date <= reminder_cutoff,
            )
            .order_by(Pickup.scheduled_date)
        ).all()

        for pickup in pickups:

            if not pickup.customer:
                continue

            if not pickup.customer.user_id:
                continue

            scheduled_date = pickup.scheduled_date

            if scheduled_date is None:
                continue

            event_key = (
                f"PICKUP_REMINDER:"
                f"{pickup.id}:"
                f"{scheduled_date.isoformat()}"
            )

            title = "Pickup Reminder"

            body = (
                f"Pickup {pickup.pickup_code} is scheduled "
                f"for {scheduled_date.isoformat()}."
            )

            metadata = {
                "pickup_id": pickup.id,
                "pickup_code": pickup.pickup_code,
                "scheduled_date": scheduled_date.isoformat(),
                "reminder_hours": reminder_hours,
            }

            create_notification(
                db,
                user_id=pickup.customer.user_id,
                notification_type=NotificationType.PICKUP_REMINDER,
                channel=NotificationChannel.IN_APP,
                title=title,
                body=body,
                event_key=event_key,
                metadata=metadata,
            )

            create_notification(
                db,
                user_id=pickup.customer.user_id,
                notification_type=NotificationType.PICKUP_REMINDER,
                channel=NotificationChannel.EMAIL,
                title=title,
                body=body,
                event_key=event_key,
                metadata=metadata,
            )

            create_notification(
                db,
                user_id=pickup.customer.user_id,
                notification_type=NotificationType.PICKUP_REMINDER,
                channel=NotificationChannel.WHATSAPP,
                title=title,
                body=body,
                event_key=event_key,
                metadata=metadata,
            )

            processed += 1

        db.commit()

        return processed

    finally:
        db.close()