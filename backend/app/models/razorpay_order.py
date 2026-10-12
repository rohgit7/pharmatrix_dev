
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RazorpayOrder(Base):
    __tablename__ = "razorpay_orders"

    __table_args__ = (
        CheckConstraint(
            "amount_paise > 0",
            name="ck_razorpay_order_amount_positive",
        ),
        UniqueConstraint(
            "razorpay_order_id",
            name="uq_razorpay_order_provider_order_id",
        ),
        UniqueConstraint(
            "razorpay_payment_id",
            name="uq_razorpay_order_provider_payment_id",
        ),
        UniqueConstraint(
            "invoice_id",
            "idempotency_key",
            name="uq_razorpay_order_invoice_idempotency_key",
        ),
        Index(
            "ix_razorpay_order_invoice_status",
            "invoice_id",
            "status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    razorpay_order_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Razorpay expects integer paise for INR orders.
    amount_paise: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        default="INR",
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="CREATED",
        nullable=False,
    )

    razorpay_payment_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    idempotency_key: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    failure_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
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

    invoice = relationship("Invoice")
