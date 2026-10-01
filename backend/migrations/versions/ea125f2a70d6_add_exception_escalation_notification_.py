"""add exception escalation notification type

Revision ID: ea125f2a70d6
Revises: 7fcd1b947cdc
Create Date: 2026-10-01 17:17:38.350027

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ea125f2a70d6'
down_revision: Union[str, Sequence[str], None] = '7fcd1b947cdc'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE notificationtype "
        "ADD VALUE IF NOT EXISTS 'PICKUP_REMINDER'"
    )

    op.execute(
        "ALTER TYPE notificationtype "
        "ADD VALUE IF NOT EXISTS 'EXCEPTION_ESCALATED'"
    )


def downgrade() -> None:
    pass