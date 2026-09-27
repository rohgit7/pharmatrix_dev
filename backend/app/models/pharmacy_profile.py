from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PharmacyProfile(Base):
    __tablename__ = "pharmacy_profiles"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            name="uq_pharmacy_profiles_customer_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    pharmacy_license_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    pharmacist_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    license_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="pharmacy_profile",
    )