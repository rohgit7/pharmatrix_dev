from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DistributorProfile(Base):
    __tablename__ = "distributor_profiles"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            name="uq_distributor_profiles_customer_id",
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

    distribution_license_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    warehouse_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    coverage_area: Mapped[str | None] = mapped_column(
        String(250),
        nullable=True,
    )

    license_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="distributor_profile",
    )