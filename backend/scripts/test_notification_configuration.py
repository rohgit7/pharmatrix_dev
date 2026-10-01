from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.enums import NotificationChannel, NotificationStatus
from app.models.notification import Notification
from app.services.configuration_runtime_service import (
    get_configuration_bool,
)


def main():
    db = SessionLocal()

    try:
        email_enabled = get_configuration_bool(
            db,
            "notifications.email_enabled",
        )

        whatsapp_enabled = get_configuration_bool(
            db,
            "notifications.whatsapp_enabled",
        )

        print("=== Notification Configuration ===")
        print(f"Email enabled: {email_enabled}")
        print(f"WhatsApp enabled: {whatsapp_enabled}")

        print("\n=== Pending Notifications ===")

        email_pending = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.status == NotificationStatus.PENDING,
                Notification.channel == NotificationChannel.EMAIL,
            )
        )

        whatsapp_pending = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.status == NotificationStatus.PENDING,
                Notification.channel == NotificationChannel.WHATSAPP,
            )
        )

        in_app_pending = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.status == NotificationStatus.PENDING,
                Notification.channel == NotificationChannel.IN_APP,
            )
        )

        print(f"Pending Email: {email_pending}")
        print(f"Pending WhatsApp: {whatsapp_pending}")
        print(f"Pending In-App: {in_app_pending}")

        print("\n=== Worker Eligibility ===")

        if email_enabled:
            print("EMAIL: ENABLED -> eligible for worker")
        else:
            print("EMAIL: DISABLED -> worker will leave pending")

        if whatsapp_enabled:
            print("WHATSAPP: ENABLED -> eligible for worker")
        else:
            print("WHATSAPP: DISABLED -> worker will leave pending")

        print("IN-APP: handled separately from external notification worker")

    finally:
        db.close()


if __name__ == "__main__":
    main()