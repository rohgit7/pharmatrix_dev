from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RouteStatus


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    route_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    route_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    driver_id: Mapped[int | None] = mapped_column(
        ForeignKey("drivers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    vehicle_id: Mapped[int | None] = mapped_column(
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status: Mapped[RouteStatus] = mapped_column(
        SAEnum(
            RouteStatus,
            name="routestatus",
            native_enum=True,
        ),
        nullable=False,
        default=RouteStatus.DRAFT,
    )

    planned_distance_km: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    planned_duration_seconds: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    optimized_at: Mapped[datetime | None] = mapped_column(
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

    warehouse = relationship(
        "Warehouse",
        back_populates="routes",
    )

    driver = relationship(
        "Driver",
    )

    vehicle = relationship(
        "Vehicle",
    )

    stops = relationship(
        "RouteStop",
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteStop.sequence_number",
    )