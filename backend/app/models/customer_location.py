from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CustomerLocation(Base):
    __tablename__ = "customer_locations"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            "location_code",
            name="uq_customer_location_code",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    location_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    address_line_1: Mapped[str] = mapped_column(
        String(250),
        nullable=False,
    )

    address_line_2: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    city: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    state: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    postal_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    latitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    longitude: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    contact_name: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    contact_phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    location_photo: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    service_time_seconds: Mapped[int] = mapped_column(
        Integer,
        default=300,
        nullable=False,
    )

    pickup_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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

    customer = relationship(
        "Customer",
        back_populates="locations",
    )