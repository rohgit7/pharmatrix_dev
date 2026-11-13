"""add device tokens and push notifications

Revision ID: e3d7a82b49c1
Revises: ae071d8e153e
Create Date: 2026-11-11 14:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3d7a82b49c1'
down_revision: Union[str, Sequence[str], None] = 'ae071d8e153e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_NOTIFICATION_TYPES = [
    'DRIVER_APPROACHING',
    'DRIVER_ARRIVED',
    'WEIGHT_RECORDED',
    'PAYMENT_REQUIRED',
    'PAYMENT_SUCCESSFUL',
    'OTP_GENERATED',
    'ROUTE_UPDATED',
    'PICKUP_CANCELLED',
    'OPERATIONAL_ALERT',
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            "ALTER TYPE notificationchannel "
            "ADD VALUE IF NOT EXISTS 'PUSH'"
        )
        for ntype in NEW_NOTIFICATION_TYPES:
            op.execute(
                f"ALTER TYPE notificationtype "
                f"ADD VALUE IF NOT EXISTS '{ntype}'"
            )

    op.create_table(
        'device_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('expo_push_token', sa.String(length=255), nullable=False),
        sa.Column('device_platform', sa.String(length=30), nullable=False, server_default='android'),
        sa.Column('device_name', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'expo_push_token', name='uq_device_token_user_expo'),
    )
    op.create_index(op.f('ix_device_tokens_user_id'), 'device_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_device_tokens_expo_push_token'), 'device_tokens', ['expo_push_token'], unique=False)
    op.create_index(op.f('ix_device_tokens_is_active'), 'device_tokens', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_device_tokens_is_active'), table_name='device_tokens')
    op.drop_index(op.f('ix_device_tokens_expo_push_token'), table_name='device_tokens')
    op.drop_index(op.f('ix_device_tokens_user_id'), table_name='device_tokens')
    op.drop_table('device_tokens')

