"""add next day operations optimization runs and audit trail

Revision ID: 3481e19d7b22
Revises: 2198e89dac8a
Create Date: 2026-10-22 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3481e19d7b22'
down_revision: Union[str, Sequence[str], None] = '2198e89dac8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create optimization_runs table
    op.create_table(
        'optimization_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_code', sa.String(length=50), nullable=False),
        sa.Column('planning_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='DRAFT'),
        sa.Column('routes_created', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('pickups_assigned', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('summary_metrics', sa.JSON(), nullable=True),
        sa.Column('parameters', sa.JSON(), nullable=True),
        sa.Column('unassigned_pickups', sa.JSON(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_optimization_runs_run_code'), 'optimization_runs', ['run_code'], unique=True)
    op.create_index(op.f('ix_optimization_runs_planning_date'), 'optimization_runs', ['planning_date'], unique=False)
    op.create_index(op.f('ix_optimization_runs_warehouse_id'), 'optimization_runs', ['warehouse_id'], unique=False)
    op.create_index(op.f('ix_optimization_runs_status'), 'optimization_runs', ['status'], unique=False)

    # 2. Add approved_at, approved_by_id, and optimization_run_id to routes table
    op.add_column('routes', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('routes', sa.Column('approved_by_id', sa.Integer(), nullable=True))
    op.add_column('routes', sa.Column('optimization_run_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_routes_approved_by', 'routes', 'users', ['approved_by_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_routes_optimization_run', 'routes', 'optimization_runs', ['optimization_run_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_routes_optimization_run_id'), 'routes', ['optimization_run_id'], unique=False)

    # 3. Create operational audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.String(length=100), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('actor_email', sa.String(length=255), nullable=True),
        sa.Column('old_values', sa.JSON(), nullable=True),
        sa.Column('new_values', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_logs_entity_type'), 'audit_logs', ['entity_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_actor_id'), 'audit_logs', ['actor_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_constraint('fk_routes_optimization_run', 'routes', type_='foreignkey')
    op.drop_constraint('fk_routes_approved_by', 'routes', type_='foreignkey')
    op.drop_index(op.f('ix_routes_optimization_run_id'), table_name='routes')
    op.drop_column('routes', 'optimization_run_id')
    op.drop_column('routes', 'approved_by_id')
    op.drop_column('routes', 'approved_at')
    op.drop_table('optimization_runs')
