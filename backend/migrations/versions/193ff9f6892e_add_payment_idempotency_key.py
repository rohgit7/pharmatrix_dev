"""add payment idempotency key

Revision ID: 193ff9f6892e
Revises: ce054902023b
Create Date: 2026-10-11 21:02:18.244077

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '193ff9f6892e'
down_revision: Union[str, Sequence[str], None] = 'ce054902023b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("idempotency_key", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(
        "uq_payment_invoice_idempotency_key",
        "payments",
        ["invoice_id", "idempotency_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_payment_invoice_idempotency_key",
        "payments",
        type_="unique",
    )
    op.drop_column("payments", "idempotency_key")
