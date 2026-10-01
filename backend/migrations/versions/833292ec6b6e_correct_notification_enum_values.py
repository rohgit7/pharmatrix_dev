"""correct notification enum values

Revision ID: 833292ec6b6e
Revises: cda8c18dcc5e
Create Date: 2026-10-01 17:50:53.308335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '833292ec6b6e'
down_revision: Union[str, Sequence[str], None] = 'cda8c18dcc5e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE public.notificationtype "
        "ADD VALUE IF NOT EXISTS 'PICKUP_REMINDER'"
    )

    op.execute(
        "ALTER TYPE public.notificationtype "
        "ADD VALUE IF NOT EXISTS 'EXCEPTION_ESCALATED'"
    )


def downgrade() -> None:
    pass