from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RouteStopType

from sqlalchemy import Numeric, String
from app.models.enums import RouteStopStatus


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    route_id: Mapped[int] = mapped_column(
        ForeignKey("routes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sequence_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    stop_type: Mapped[RouteStopType] = mapped_column(
        SAEnum(
            RouteStopType,
            name="routestoptype",
            native_enum=True,
        ),
        nullable=False,
    )

    pickup_id: Mapped[int | None] = mapped_column(
        ForeignKey("pickups.id", ondelete="RESTRICT"),
        nullable=True,
        unique=True,
    )

    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=True,
    )

    arrival_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    departure_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    route = relationship(
        "Route",
        back_populates="stops",
    )

    pickup = relationship(
        "Pickup",
    )

    warehouse = relationship(
        "Warehouse",
    )

    execution_status: Mapped[RouteStopStatus] = mapped_column(
        SAEnum(
            RouteStopStatus,
            name="routestopstatus",
            native_enum=True,
        ),
        nullable=False,
        default=RouteStopStatus.PENDING,
    )

    arrived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    collected_weight_kg: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )
    proof_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    proof_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failure_reason: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "sequence_number > 0",
            name="ck_route_stops_sequence_positive",
        ),
        CheckConstraint(
            """
            (
                stop_type = 'PICKUP'
                AND pickup_id IS NOT NULL
                AND warehouse_id IS NULL
            )
            OR
            (
                stop_type = 'WAREHOUSE'
                AND pickup_id IS NULL
                AND warehouse_id IS NOT NULL
            )
            """,
            name="ck_route_stops_type_reference",
        ),
    )