from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import text

from app.core.database import Base


class DriverVehicleAssignment(Base):
    __tablename__ = "driver_vehicle_assignments"

    __table_args__ = (
        CheckConstraint(
            "unassigned_at IS NULL OR unassigned_at > assigned_at",
            name="ck_assignment_valid_dates",
        ),

        Index(
            "uq_active_driver_assignment",
            "driver_id",
            unique=True,
            postgresql_where=text("unassigned_at IS NULL"),
        ),

        Index(
            "uq_active_vehicle_assignment",
            "vehicle_id",
            unique=True,
            postgresql_where=text("unassigned_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    driver_id: Mapped[int] = mapped_column(
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    driver = relationship(
        "Driver",
        back_populates="vehicle_assignments",
    )

    vehicle = relationship(
        "Vehicle",
        back_populates="driver_assignments",
    )