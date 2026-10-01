"""sync notification types

Revision ID: cda8c18dcc5e
Revises: ea125f2a70d6
Create Date: 2026-10-01 17:43:38.486277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cda8c18dcc5e'
down_revision: Union[str, Sequence[str], None] = 'ea125f2a70d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
