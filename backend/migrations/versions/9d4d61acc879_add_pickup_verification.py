"""add pickup verification

Revision ID: YOUR_GENERATED_REVISION
Revises: YOUR_PREVIOUS_REVISION
"""

from typing import Sequence, Union
import secrets

from alembic import op
import sqlalchemy as sa


revision: str = "9d4d61acc879"
down_revision: Union[str, Sequence[str], None] = "aaddcdeecec5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ------------------------------------------------------------
    # Temporarily nullable so existing pickups can be populated
    # ------------------------------------------------------------
    op.add_column(
        "pickups",
        sa.Column(
            "verification_token",
            sa.String(length=128),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "qr_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_hash",
            sa.String(length=64),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "pickups",
        sa.Column(
            "otp_verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    # ------------------------------------------------------------
    # Populate existing pickups
    # ------------------------------------------------------------
    connection = op.get_bind()

    pickups = connection.execute(
        sa.text(
            "SELECT id FROM pickups "
            "WHERE verification_token IS NULL"
        )
    ).fetchall()

    for pickup in pickups:
        connection.execute(
            sa.text(
                """
                UPDATE pickups
                SET verification_token = :token
                WHERE id = :pickup_id
                """
            ),
            {
                "pickup_id": pickup.id,
                "token": secrets.token_urlsafe(32),
            },
        )

    # ------------------------------------------------------------
    # Make token mandatory
    # ------------------------------------------------------------
    op.alter_column(
        "pickups",
        "verification_token",
        nullable=False,
    )

    # ------------------------------------------------------------
    # Unique constraint
    # ------------------------------------------------------------
    op.create_unique_constraint(
        "uq_pickups_verification_token",
        "pickups",
        ["verification_token"],
    )

    # Remove migration-time default.
    op.alter_column(
        "pickups",
        "otp_attempts",
        server_default=None,
    )


def downgrade() -> None:

    op.drop_constraint(
        "uq_pickups_verification_token",
        "pickups",
        type_="unique",
    )

    op.drop_column(
        "pickups",
        "otp_verified_at",
    )

    op.drop_column(
        "pickups",
        "otp_attempts",
    )

    op.drop_column(
        "pickups",
        "otp_expires_at",
    )

    op.drop_column(
        "pickups",
        "otp_hash",
    )

    op.drop_column(
        "pickups",
        "qr_verified_at",
    )

    op.drop_column(
        "pickups",
        "verification_token",
    )