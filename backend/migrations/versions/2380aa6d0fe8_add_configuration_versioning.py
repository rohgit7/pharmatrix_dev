"""add configuration versioning

Revision ID: 2380aa6d0fe8
Revises: f5af96954d79
Create Date: 2026-09-30 22:02:34.950307

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2380aa6d0fe8"
down_revision: Union[str, Sequence[str], None] = "f5af96954d79"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1. Create configurations first.
    # current_version_id is added without its FK initially because
    # configuration_versions does not exist yet.
    op.create_table(
        "configurations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "key",
            sa.String(length=150),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "data_type",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "scope",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "scope_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "current_version_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_configurations_key"),
        "configurations",
        ["key"],
        unique=True,
    )

    # 2. Create configuration_versions after configurations exists.
    op.create_table(
        "configuration_versions",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "configuration_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "value",
            sa.JSON(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
        ),
        sa.Column(
            "effective_from",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "effective_until",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "approved_by",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "reason",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "change_reference",
            sa.String(length=150),
            nullable=True,
        ),
        sa.Column(
            "previous_version_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "rollback_of_version_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["approved_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["configuration_id"],
            ["configurations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["previous_version_id"],
            ["configuration_versions.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["rollback_of_version_id"],
            ["configuration_versions.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "configuration_id",
            "version",
            name="uq_configuration_version",
        ),
    )

    op.create_index(
        op.f("ix_configuration_versions_configuration_id"),
        "configuration_versions",
        ["configuration_id"],
        unique=False,
    )

    # 3. Now that configuration_versions exists,
    # add configurations.current_version_id -> configuration_versions.id.
    op.create_foreign_key(
        "fk_configurations_current_version_id",
        "configurations",
        "configuration_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""

    # Remove the circular FK first.
    op.drop_constraint(
        "fk_configurations_current_version_id",
        "configurations",
        type_="foreignkey",
    )

    # Drop the dependent table first.
    op.drop_index(
        op.f("ix_configuration_versions_configuration_id"),
        table_name="configuration_versions",
    )

    op.drop_table("configuration_versions")

    # Finally drop configurations.
    op.drop_index(
        op.f("ix_configurations_key"),
        table_name="configurations",
    )

    op.drop_table("configurations")