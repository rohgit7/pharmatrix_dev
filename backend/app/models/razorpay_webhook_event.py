
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RazorpayWebhookEvent(Base):
    __tablename__ = "razorpay_webhook_events"

    __table_args__ = (
        UniqueConstraint(
            "event_id",
            name="uq_razorpay_webhook_event_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    event_id: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    payload_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="RECEIVED",
        nullable=False,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
