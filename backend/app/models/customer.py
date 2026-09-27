from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CustomerType


class Customer(Base):
    __tablename__ = "customers"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            name="uq_customers_user_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    customer_type: Mapped[CustomerType] = mapped_column(
        SAEnum(
            CustomerType,
            name="customer_type",
            native_enum=True,
        ),
        nullable=False,
    )

    legal_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    display_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    gst_number: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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

    user = relationship(
        "User",
        back_populates="customer",
    )

    locations = relationship(
        "CustomerLocation",
        back_populates="customer",
        cascade="all, delete-orphan",
    )

    pharmacy_profile = relationship(
        "PharmacyProfile",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    distributor_profile = relationship(
        "DistributorProfile",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    hospital_profile = relationship(
        "HospitalProfile",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    clinic_profile = relationship(
        "ClinicProfile",
        back_populates="customer",
        uselist=False,
        cascade="all, delete-orphan",
    )

    documents = relationship(
        "CustomerDocument",
        back_populates="customer",
        cascade="all, delete-orphan",
    )