"""add otp request rate limiting

Revision ID: f2d937ea62d7
Revises: 2d554a6f6f72
Create Date: 2026-10-01 18:56:37.596065

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2d937ea62d7'
down_revision: Union[str, Sequence[str], None] = '2d554a6f6f72'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pickups",
        sa.Column(
            "otp_last_requested_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_request_window_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_request_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.alter_column(
        "pickups",
        "otp_request_count",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "pickups",
        "otp_request_count",
    )

    op.drop_column(
        "pickups",
        "otp_request_window_started_at",
    )

    op.drop_column(
        "pickups",
        "otp_last_requested_at",
    )