from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CustomerDocumentType(str, Enum):
    AADHAAR = "AADHAAR"
    DRUG_LICENSE = "DRUG_LICENSE"
    BUSINESS_REGISTRATION = "BUSINESS_REGISTRATION"
    GST_CERTIFICATE = "GST_CERTIFICATE"
    OTHER = "OTHER"


class CustomerDocument(Base):
    __tablename__ = "customer_documents"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    document_type: Mapped[CustomerDocumentType] = mapped_column(
        SAEnum(
            CustomerDocumentType,
            name="customer_document_type",
            native_enum=True,
        ),
        nullable=False,
    )

    document_number: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    document_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="documents",
    )