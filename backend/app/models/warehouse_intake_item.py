from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import WasteBinColor, WasteType


class WarehouseIntakeItem(Base):
    __tablename__ = "warehouse_intake_items"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    intake_id: Mapped[int] = mapped_column(
        ForeignKey(
            "warehouse_intakes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    bin_color: Mapped[WasteBinColor] = mapped_column(
        SAEnum(
            WasteBinColor,
            name="wastebincolor",
            native_enum=True,
        ),
        nullable=False,
    )

    waste_type: Mapped[WasteType] = mapped_column(
        SAEnum(
            WasteType,
            name="wastetype",
            native_enum=True,
        ),
        nullable=False,
    )

    expected_weight_kg: Mapped[float] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    received_weight_kg: Mapped[float | None] = mapped_column(
        Numeric(10, 2),
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

    intake = relationship(
        "WarehouseIntake",
        back_populates="items",
    )

    disposal_shipment_items = relationship(
        "DisposalShipmentItem",
        back_populates="warehouse_intake_item",
    )

    __table_args__ = (
        UniqueConstraint(
            "intake_id",
            "bin_color",
            "waste_type",
            name="uq_intake_waste_type",
        ),
    )