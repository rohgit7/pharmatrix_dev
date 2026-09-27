from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import VehicleStatus, VehicleType


class Vehicle(Base):
    __tablename__ = "vehicles"

    __table_args__ = (
        UniqueConstraint(
            "registration_number",
            name="uq_vehicles_registration_number",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    registration_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    vehicle_type: Mapped[VehicleType] = mapped_column(
        SAEnum(
            VehicleType,
            name="vehicletype",
            native_enum=True,
        ),
        nullable=False,
    )

    capacity_kg: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    status: Mapped[VehicleStatus] = mapped_column(
        SAEnum(
            VehicleStatus,
            name="vehiclestatus",
            native_enum=True,
        ),
        nullable=False,
        default=VehicleStatus.AVAILABLE,
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

    vehicle_assignments = relationship(
        "DriverVehicleAssignment",
        back_populates="vehicle",
        cascade="all, delete-orphan",
    )

    driver_assignments = relationship(
    "DriverVehicleAssignment",
    back_populates="vehicle",
    cascade="all, delete-orphan",
    )