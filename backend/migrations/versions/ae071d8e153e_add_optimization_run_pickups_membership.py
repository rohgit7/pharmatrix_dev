"""add_optimization_run_pickups_membership

Revision ID: ae071d8e153e
Revises: 3481e19d7b22
Create Date: 2026-10-24 15:40:31.986289

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae071d8e153e'
down_revision: Union[str, Sequence[str], None] = '3481e19d7b22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'optimization_run_pickups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('optimization_run_id', sa.Integer(), nullable=False),
        sa.Column('pickup_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['optimization_run_id'], ['optimization_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['pickup_id'], ['pickups.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('optimization_run_id', 'pickup_id', name='uq_optimization_run_pickup'),
    )
    op.create_index(
        op.f('ix_optimization_run_pickups_optimization_run_id'),
        'optimization_run_pickups',
        ['optimization_run_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_optimization_run_pickups_pickup_id'),
        'optimization_run_pickups',
        ['pickup_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_optimization_run_pickups_pickup_id'), table_name='optimization_run_pickups')
    op.drop_index(op.f('ix_optimization_run_pickups_optimization_run_id'), table_name='optimization_run_pickups')
    op.drop_table('optimization_run_pickups')
