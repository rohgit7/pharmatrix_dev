from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import DisposalShipmentStatus


class DisposalShipment(Base):
    __tablename__ = "disposal_shipments"

    id: Mapped[int] = mapped_column(primary_key=True)

    shipment_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    intake_id: Mapped[int] = mapped_column(
        ForeignKey("warehouse_intakes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    facility_id: Mapped[int] = mapped_column(
        ForeignKey("facilities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[DisposalShipmentStatus] = mapped_column(
        nullable=False,
        default=DisposalShipmentStatus.CREATED,
    )

    expected_weight_kg: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    received_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
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
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    intake = relationship(
        "WarehouseIntake",
        back_populates="disposal_shipments",
    )

    facility = relationship(
        "Facility",
        back_populates="disposal_shipments",
    )

    items = relationship(
        "DisposalShipmentItem",
        back_populates="shipment",
        cascade="all, delete-orphan",
        order_by="DisposalShipmentItem.id",
    )

    certificate = relationship(
        "DisposalCertificate",
        back_populates="shipment",
        uselist=False,
    )

    __table_args__ = (
        CheckConstraint(
            "expected_weight_kg > 0",
            name="ck_disposal_shipments_expected_weight_positive",
        ),
        CheckConstraint(
            "received_weight_kg IS NULL OR received_weight_kg >= 0",
            name="ck_disposal_shipments_received_weight_nonnegative",
        ),
    )


class DisposalShipmentItem(Base):
    __tablename__ = "disposal_shipment_items"

    id: Mapped[int] = mapped_column(primary_key=True)

    shipment_id: Mapped[int] = mapped_column(
        ForeignKey("disposal_shipments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    warehouse_intake_item_id: Mapped[int] = mapped_column(
        ForeignKey("warehouse_intake_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    expected_weight_kg: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    received_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    shipment = relationship(
        "DisposalShipment",
        back_populates="items",
    )

    warehouse_intake_item = relationship(
        "WarehouseIntakeItem",
        back_populates="disposal_shipment_items",
    )
    

    __table_args__ = (
        UniqueConstraint(
            "shipment_id",
            "warehouse_intake_item_id",
            name="uq_disposal_shipment_item",
        ),
        CheckConstraint(
            "expected_weight_kg > 0",
            name="ck_disposal_shipment_items_expected_weight_positive",
        ),
        CheckConstraint(
            "received_weight_kg IS NULL OR received_weight_kg >= 0",
            name="ck_disposal_shipment_items_received_weight_nonnegative",
        ),
    )