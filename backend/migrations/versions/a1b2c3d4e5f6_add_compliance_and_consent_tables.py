"""add user consent and marketing preference compliance tables

Revision ID: a1b2c3d4e5f6
Revises: f8c9a12b3d4e
Create Date: 2026-11-14 20:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f8c9a12b3d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_consents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('consent_type', sa.String(length=50), nullable=False),
        sa.Column('policy_version', sa.String(length=20), nullable=False, server_default='1.0.0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='CONSENTED'),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('consented_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('withdrawn_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_user_consents_user_id', 'user_consents', ['user_id'], unique=False)
    op.create_index('ix_user_consents_consent_type', 'user_consents', ['consent_type'], unique=False)
    op.create_index('ix_user_consents_status', 'user_consents', ['status'], unique=False)

    op.create_table(
        'marketing_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('email_promotions', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sms_promotions', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('whatsapp_promotions', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('push_promotions', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_marketing_preferences_user_id'),
    )
    op.create_index('ix_marketing_preferences_user_id', 'marketing_preferences', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_marketing_preferences_user_id', table_name='marketing_preferences')
    op.drop_table('marketing_preferences')
    op.drop_index('ix_user_consents_status', table_name='user_consents')
    op.drop_index('ix_user_consents_consent_type', table_name='user_consents')
    op.drop_index('ix_user_consents_user_id', table_name='user_consents')
    op.drop_table('user_consents')

