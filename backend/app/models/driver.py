from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import DriverStatus


class Driver(Base):
    __tablename__ = "drivers"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_drivers_user_id",
        ),
        UniqueConstraint(
            "employee_id",
            name="uq_drivers_employee_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        
    )

    employee_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    license_number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
    )

    license_expiry: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    status: Mapped[DriverStatus] = mapped_column(
        SAEnum(
            DriverStatus,
            name="driverstatus",
            native_enum=True,
        ),
        nullable=False,
        default=DriverStatus.ACTIVE,
    )

    is_available: Mapped[bool] = mapped_column(
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

    user = relationship(
        "User",
        back_populates="driver",
    )

    vehicle_assignments = relationship(
        "DriverVehicleAssignment",
        back_populates="driver",
        cascade="all, delete-orphan",
    )