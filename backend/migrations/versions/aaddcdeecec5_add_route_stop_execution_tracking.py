"""add route stop execution tracking

Revision ID: aaddcdeecec5
Revises: d8c1355407a3
Create Date: 2026-09-27

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "aaddcdeecec5"
down_revision: Union[str, Sequence[str], None] = "d8c1355407a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ---------------------------------------------------------------
    # Create PostgreSQL enum type first
    # ---------------------------------------------------------------
    route_stop_status = postgresql.ENUM(
        "PENDING",
        "ARRIVED",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
        name="routestopstatus",
        create_type=False,
    )

    route_stop_status.create(
        op.get_bind(),
        checkfirst=True,
    )

    # ---------------------------------------------------------------
    # Add execution status
    #
    # Existing route stops receive PENDING.
    # After migration the column remains NOT NULL, but no permanent
    # server default is kept.
    # ---------------------------------------------------------------
    op.add_column(
        "route_stops",
        sa.Column(
            "execution_status",
            route_stop_status,
            nullable=False,
            server_default="PENDING",
        ),
    )

    op.alter_column(
        "route_stops",
        "execution_status",
        server_default=None,
    )

    # ---------------------------------------------------------------
    # Arrival timestamp
    # ---------------------------------------------------------------
    op.add_column(
        "route_stops",
        sa.Column(
            "arrived_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------------
    # Completion timestamp
    # ---------------------------------------------------------------
    op.add_column(
        "route_stops",
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------------
    # Actual collected weight
    # ---------------------------------------------------------------
    op.add_column(
        "route_stops",
        sa.Column(
            "collected_weight_kg",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------------
    # Failure reason
    # ---------------------------------------------------------------
    op.add_column(
        "route_stops",
        sa.Column(
            "failure_reason",
            sa.String(length=1000),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Remove columns first.
    op.drop_column(
        "route_stops",
        "failure_reason",
    )

    op.drop_column(
        "route_stops",
        "collected_weight_kg",
    )

    op.drop_column(
        "route_stops",
        "completed_at",
    )

    op.drop_column(
        "route_stops",
        "arrived_at",
    )

    op.drop_column(
        "route_stops",
        "execution_status",
    )

    # Then remove PostgreSQL enum.
    route_stop_status = postgresql.ENUM(
        "PENDING",
        "ARRIVED",
        "IN_PROGRESS",
        "COMPLETED",
        "FAILED",
        name="routestopstatus",
    )

    route_stop_status.drop(
        op.get_bind(),
        checkfirst=True,
    )