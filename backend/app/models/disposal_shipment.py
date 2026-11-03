from datetime import datetime
from decimal import Decimal
from sqlalchemy import Uuid, text
from uuid import UUID
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

    public_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        server_default=text("gen_random_uuid()"),
    )

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

    @property
    def intake_code(self) -> str | None:
        try:
            return self.intake.intake_code if self.intake else None
        except Exception:
            return None

    @property
    def warehouse_id(self) -> int | None:
        try:
            return self.intake.warehouse_id if self.intake else None
        except Exception:
            return None

    @property
    def warehouse_code(self) -> str | None:
        try:
            return self.intake.warehouse.code if self.intake and self.intake.warehouse else None
        except Exception:
            return None

    @property
    def warehouse_name(self) -> str | None:
        try:
            return self.intake.warehouse.name if self.intake and self.intake.warehouse else None
        except Exception:
            return None

    @property
    def warehouse_city(self) -> str | None:
        try:
            return self.intake.warehouse.city if self.intake and self.intake.warehouse else None
        except Exception:
            return None

    @property
    def warehouse_address(self) -> str | None:
        try:
            return self.intake.warehouse.address if self.intake and self.intake.warehouse else None
        except Exception:
            return None

    @property
    def route_code(self) -> str | None:
        try:
            return self.intake.route.route_code if self.intake and self.intake.route else None
        except Exception:
            return None

    @property
    def vehicle_registration(self) -> str | None:
        try:
            return self.intake.vehicle.registration_number if self.intake and self.intake.vehicle else None
        except Exception:
            return None

    @property
    def pickup_count(self) -> int:
        try:
            if not self.intake or not self.intake.route or not self.intake.route.stops:
                return 0
            return sum(
                1
                for stop in self.intake.route.stops
                if getattr(stop.stop_type, "value", str(stop.stop_type)) == "PICKUP"
            )
        except Exception:
            return 0

    @property
    def pickups_summary(self) -> list[dict]:
        try:
            if not self.intake or not self.intake.route or not self.intake.route.stops:
                return []
            result = []
            for stop in self.intake.route.stops:
                if getattr(stop.stop_type, "value", str(stop.stop_type)) != "PICKUP":
                    continue
                pickup = stop.pickup
                if not pickup:
                    continue
                customer = getattr(pickup, "customer", None)
                location = getattr(pickup, "location", None)
                cust_type = getattr(customer, "customer_type", None)
                status_val = getattr(pickup, "status", None)
                result.append(
                    {
                        "pickup_id": pickup.id,
                        "pickup_code": pickup.pickup_code,
                        "generator_code": getattr(customer, "customer_code", None)
                        or getattr(location, "location_code", None),
                        "generator_type": cust_type.value
                        if hasattr(cust_type, "value")
                        else (str(cust_type) if cust_type else None),
                        "city": getattr(location, "city", None),
                        "estimated_weight_kg": float(pickup.estimated_weight_kg)
                        if pickup.estimated_weight_kg is not None
                        else None,
                        "collected_weight_kg": float(stop.collected_weight_kg)
                        if stop.collected_weight_kg is not None
                        else None,
                        "status": status_val.value if hasattr(status_val, "value") else str(status_val),
                        "collected_at": (pickup.collected_at or stop.completed_at).isoformat()
                        if (pickup.collected_at or stop.completed_at)
                        else None,
                    }
                )
            return result
        except Exception:
            return []

    @property
    def certificate_info(self) -> dict | None:
        try:
            cert = self.certificate
            if not cert:
                return None
            return {
                "id": cert.id,
                "public_id": str(cert.public_id),
                "certificate_code": cert.certificate_code,
                "certificate_number": cert.certificate_number,
                "file_name": cert.file_name,
                "content_type": cert.content_type,
                "storage_path": cert.storage_path,
                "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
                "uploaded_at": cert.uploaded_at.isoformat() if cert.uploaded_at else None,
                "notes": cert.notes,
            }
        except Exception:
            return None

    __table_args__ = (
        CheckConstraint(
            "expected_weight_kg > 0",
            name="ck_disposal_shipments_expected_weight_positive",
        ),
        CheckConstraint(
            "received_weight_kg IS NULL OR received_weight_kg >= 0",
            name="ck_disposal_shipments_received_weight_nonnegative",
        ),
        UniqueConstraint(
            "public_id",
            name="uq_disposal_shipments_public_id",
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

    @property
    def bin_color(self) -> str | None:
        try:
            wii = self.warehouse_intake_item
            if wii and getattr(wii, "bin_color", None) is not None:
                val = wii.bin_color
                return val.value if hasattr(val, "value") else str(val)
            return None
        except Exception:
            return None

    @property
    def waste_type(self) -> str | None:
        try:
            wii = self.warehouse_intake_item
            if wii and getattr(wii, "waste_type", None) is not None:
                val = wii.waste_type
                return val.value if hasattr(val, "value") else str(val)
            return None
        except Exception:
            return None

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
