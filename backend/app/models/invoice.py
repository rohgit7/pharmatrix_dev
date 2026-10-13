
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Uuid,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Invoice(Base):
    __tablename__ = "invoices"

    __table_args__ = (
        CheckConstraint(
            "subtotal >= 0 AND tax_amount >= 0 "
            "AND total_amount >= 0 AND amount_paid >= 0",
            name="ck_invoice_amounts_nonnegative",
        ),
        CheckConstraint(
            "amount_paid <= total_amount",
            name="ck_invoice_paid_not_above_total",
        ),
        UniqueConstraint("invoice_number", name="uq_invoice_number"),
        UniqueConstraint(
            "public_id",
            name="uq_invoices_public_id",
        ),
        UniqueConstraint("pickup_id", name="uq_invoice_pickup"),
        Index("ix_invoice_customer_status", "customer_id", "status"),
        Index("ix_invoice_due_date_status", "due_date", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    public_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        server_default=text("gen_random_uuid()"),
    )

    invoice_number: Mapped[str] = mapped_column(
        String(40), nullable=False
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    pickup_id: Mapped[int] = mapped_column(
        ForeignKey("pickups.id", ondelete="RESTRICT"),
        nullable=False,
    )

    pricing_plan_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_plans.id", ondelete="RESTRICT"),
        nullable=False,
    )

    pricing_plan_version_id: Mapped[int] = mapped_column(
        ForeignKey("pricing_plan_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3), default="INR", nullable=False
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20), default="ISSUED", nullable=False
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    pricing_snapshot: Mapped[dict] = mapped_column(
        JSONB, nullable=False
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    customer = relationship("Customer")
    pickup = relationship("Pickup")
    line_items = relationship(
        "InvoiceLineItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceLineItem.id",
    )

    @property
    def outstanding_amount(self) -> Decimal:
        return self.total_amount - self.amount_paid

    @property
    def customer_public_id(self) -> UUID:
        return self.customer.public_id


    @property
    def pickup_public_id(self) -> UUID:
        return self.pickup.public_id


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    __table_args__ = (
        CheckConstraint(
            "quantity >= 0 AND unit_price >= 0 "
            "AND amount >= 0",
            name="ck_invoice_line_amounts_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_type: Mapped[str] = mapped_column(
        String(40), nullable=False
    )

    description: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), default=Decimal("1.000"), nullable=False
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )

    metadata_json: Mapped[dict] = mapped_column(
        JSONB, default=dict, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    invoice = relationship("Invoice", back_populates="line_items")
