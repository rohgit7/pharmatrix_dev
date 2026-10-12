
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PricingPlan(Base):
    __tablename__ = "pricing_plans"

    id: Mapped[int] = mapped_column(primary_key=True)

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class PricingPlanVersion(Base):
    __tablename__ = "pricing_plan_versions"

    __table_args__ = (
        UniqueConstraint(
            "pricing_plan_id",
            "version",
            name="uq_pricing_plan_version",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_pricing_version_positive",
        ),
        CheckConstraint(
            "per_kg_rate >= 0",
            name="ck_pricing_rate_nonnegative",
        ),
        CheckConstraint(
            "pickup_fee >= 0",
            name="ck_pricing_pickup_fee_nonnegative",
        ),
        CheckConstraint(
            "subscription_fee >= 0",
            name="ck_pricing_subscription_fee_nonnegative",
        ),
        CheckConstraint(
            "minimum_pickup_charge >= 0",
            name="ck_pricing_minimum_nonnegative",
        ),
        CheckConstraint(
            "included_weight_kg >= 0",
            name="ck_pricing_included_weight_nonnegative",
        ),
        CheckConstraint(
            "effective_until IS NULL OR "
            "effective_from IS NULL OR "
            "effective_until > effective_from",
            name="ck_pricing_effective_dates",
        ),
        Index(
            "ix_pricing_version_effectivity",
            "pricing_plan_id",
            "effective_from",
            "effective_until",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    pricing_plan_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="DRAFT",
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        default="INR",
        nullable=False,
    )

    # Pickup charge components. Monetary values use Decimal/Numeric.
    per_kg_rate: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False,
    )
    pickup_fee: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False,
    )
    subscription_fee: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False,
    )
    minimum_pickup_charge: Mapped[float] = mapped_column(
        Numeric(12, 2),
        default=0,
        nullable=False,
    )
    included_weight_kg: Mapped[float] = mapped_column(
        Numeric(10, 3),
        default=0,
        nullable=False,
    )

    # Extensible, versioned rules for additional fees and adjustments.
    fee_rules: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )

    effective_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    effective_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    approved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class CustomerPricingAssignment(Base):
    __tablename__ = "customer_pricing_assignments"

    __table_args__ = (
        CheckConstraint(
            "effective_until IS NULL OR "
            "effective_until > effective_from",
            name="ck_customer_pricing_effective_dates",
        ),
        Index(
            "ix_customer_pricing_effectivity",
            "customer_id",
            "effective_from",
            "effective_until",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    pricing_plan_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    effective_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    assigned_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
