from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DisposalCertificate(Base):
    __tablename__ = "disposal_certificates"

    id: Mapped[int] = mapped_column(primary_key=True)

    certificate_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    shipment_id: Mapped[int] = mapped_column(
        ForeignKey("disposal_shipments.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
    )

    certificate_number: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    shipment = relationship(
        "DisposalShipment",
        back_populates="certificate",
    )