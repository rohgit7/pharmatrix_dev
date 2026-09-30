from email.message import EmailMessage
from uuid import uuid4
import smtplib

from app.core.config import settings
from app.notifications.base import NotificationProvider


class EmailProvider(NotificationProvider):

    def send(
        self,
        recipient: str,
        title: str,
        body: str,
        metadata: dict | None = None,
    ) -> str | None:

        if not settings.SMTP_HOST:
            raise RuntimeError(
                "SMTP_HOST is not configured"
            )

        if not settings.SMTP_FROM_EMAIL:
            raise RuntimeError(
                "SMTP_FROM_EMAIL is not configured"
            )

        if not settings.SMTP_USERNAME:
            raise RuntimeError(
                "SMTP_USERNAME is not configured"
            )

        if not settings.SMTP_PASSWORD:
            raise RuntimeError(
                "SMTP_PASSWORD is not configured"
            )

        message = EmailMessage()

        message["Subject"] = title
        message["From"] = (
            f"{settings.SMTP_FROM_NAME} "
            f"<{settings.SMTP_FROM_EMAIL}>"
        )
        message["To"] = recipient
        message["Message-ID"] = (
            f"<{uuid4()}@pharmatrix>"
        )

        message.set_content(body)

        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=30,
        ) as smtp:

            if settings.SMTP_USE_TLS:
                smtp.starttls()

            smtp.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )

            smtp.send_message(message)

        return message["Message-ID"]