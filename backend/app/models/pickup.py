from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PickupPriority, PickupStatus


class Pickup(Base):
    __tablename__ = "pickups"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    pickup_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    location_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customer_locations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    status: Mapped[PickupStatus] = mapped_column(
        SAEnum(
            PickupStatus,
            name="pickupstatus",
            native_enum=True,
        ),
        nullable=False,
        default=PickupStatus.REQUESTED,
    )

    priority: Mapped[PickupPriority] = mapped_column(
        SAEnum(
            PickupPriority,
            name="pickuppriority",
            native_enum=True,
        ),
        nullable=False,
        default=PickupPriority.NORMAL,
    )

    requested_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    scheduled_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    estimated_weight_kg: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    failure_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    collected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ---------------------------------------------------------
    # Pickup verification
    # ---------------------------------------------------------

    verification_token: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
    )

    qr_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    otp_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    otp_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    otp_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    otp_last_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    otp_request_window_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    otp_request_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    otp_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ---------------------------------------------------------
    # Relationships
    # ---------------------------------------------------------

    customer = relationship(
        "Customer",
    )

    location = relationship(
        "CustomerLocation",
    )