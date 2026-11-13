"""make customer location coordinates nullable

Revision ID: f8c9a12b3d4e
Revises: e3d7a82b49c1
Create Date: 2026-11-13 13:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8c9a12b3d4e'
down_revision: Union[str, Sequence[str], None] = 'e3d7a82b49c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'customer_locations',
        'latitude',
        existing_type=sa.Float(),
        nullable=True,
    )
    op.alter_column(
        'customer_locations',
        'longitude',
        existing_type=sa.Float(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE customer_locations SET latitude = 0.0 WHERE latitude IS NULL")
    op.execute("UPDATE customer_locations SET longitude = 0.0 WHERE longitude IS NULL")
    op.alter_column(
        'customer_locations',
        'latitude',
        existing_type=sa.Float(),
        nullable=False,
    )
    op.alter_column(
        'customer_locations',
        'longitude',
        existing_type=sa.Float(),
        nullable=False,
    )

