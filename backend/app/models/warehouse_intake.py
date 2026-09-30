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
from app.models.enums import WarehouseIntakeStatus


class WarehouseIntake(Base):
    __tablename__ = "warehouse_intakes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    intake_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    route_id: Mapped[int] = mapped_column(
        ForeignKey(
            "routes.id",
            ondelete="RESTRICT",
        ),
        unique=True,
        nullable=False,
        index=True,
    )

    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey(
            "warehouses.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    driver_id: Mapped[int] = mapped_column(
        ForeignKey(
            "drivers.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey(
            "vehicles.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    status: Mapped[WarehouseIntakeStatus] = mapped_column(
        SAEnum(
            WarehouseIntakeStatus,
            name="warehouseintakestatus",
            native_enum=True,
        ),
        nullable=False,
        default=WarehouseIntakeStatus.PENDING,
    )

    expected_weight_kg: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    received_weight_kg: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    discrepancy_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
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

    route = relationship("Route",back_populates="warehouse_intake")

    warehouse = relationship("Warehouse")

    driver = relationship("Driver")

    vehicle = relationship("Vehicle")

    items = relationship(
        "WarehouseIntakeItem",
        back_populates="intake",
        cascade="all, delete-orphan",
    )

    disposal_shipments = relationship(
        "DisposalShipment",
        back_populates="intake",
    )