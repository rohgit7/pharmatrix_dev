"""add notification processing state

Revision ID: 2d554a6f6f72
Revises: 833292ec6b6e
Create Date: 2026-10-01 18:17:06.149511

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2d554a6f6f72'
down_revision: Union[str, Sequence[str], None] = '833292ec6b6e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE notificationstatus "
        "ADD VALUE IF NOT EXISTS 'PROCESSING'"
    )

    op.add_column(
        "notifications",
        sa.Column(
            "attempt_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "notifications",
        sa.Column(
            "processing_started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "notifications",
        sa.Column(
            "last_attempt_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.alter_column(
        "notifications",
        "attempt_count",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "notifications",
        "last_attempt_at",
    )

    op.drop_column(
        "notifications",
        "processing_started_at",
    )

    op.drop_column(
        "notifications",
        "attempt_count",
    )

    # PostgreSQL does not support removing an individual
    # enum value safely with a simple ALTER TYPE statement.