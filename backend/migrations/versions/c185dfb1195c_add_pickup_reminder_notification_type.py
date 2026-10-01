"""add pickup reminder notification type

Revision ID: c185dfb1195c
Revises: b856cc4dd242
Create Date: 2026-10-01 16:51:14.709216

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c185dfb1195c'
down_revision: Union[str, Sequence[str], None] = 'b856cc4dd242'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE notificationtype "
        "ADD VALUE IF NOT EXISTS 'PICKUP_REMINDER'"
    )


def downgrade() -> None:
    # PostgreSQL does not support directly removing an enum value.
    pass
