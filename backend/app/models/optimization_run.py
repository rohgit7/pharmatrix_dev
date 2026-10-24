from datetime import datetime, timezone
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    run_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    planning_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="DRAFT",
        nullable=False,
        index=True,
    )

    routes_created: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    pickups_assigned: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    summary_metrics: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    parameters: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    unassigned_pickups: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
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

    # Relationships
    warehouse = relationship("Warehouse")
    created_by = relationship("User")
    routes = relationship(
        "Route",
        back_populates="optimization_run",
    )
    submitted_pickups = relationship(
        "OptimizationRunPickup",
        back_populates="optimization_run",
        cascade="all, delete-orphan",
    )


class OptimizationRunPickup(Base):
    __tablename__ = "optimization_run_pickups"
    __table_args__ = (
        UniqueConstraint("optimization_run_id", "pickup_id", name="uq_optimization_run_pickup"),
    )

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    optimization_run_id: Mapped[int] = mapped_column(
        ForeignKey("optimization_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    pickup_id: Mapped[int] = mapped_column(
        ForeignKey("pickups.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    optimization_run = relationship("OptimizationRun", back_populates="submitted_pickups")
    pickup = relationship("Pickup")
