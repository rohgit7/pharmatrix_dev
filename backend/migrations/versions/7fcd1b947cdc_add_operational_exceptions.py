from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "7fcd1b947cdc"
down_revision = "c185dfb1195c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE operationalexceptiontype AS ENUM (
            'PICKUP_FAILED',
            'WAREHOUSE_INTAKE_DISCREPANCY',
            'DISPOSAL_SHIPMENT_DISCREPANCY'
        )
        """
    )

    op.execute(
        """
        CREATE TYPE operationalexceptionstatus AS ENUM (
            'OPEN',
            'ESCALATED',
            'RESOLVED'
        )
        """
    )

    op.create_table(
        "operational_exceptions",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "exception_type",
            postgresql.ENUM(
                name="operationalexceptiontype",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                name="operationalexceptionstatus",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "source_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "reason",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "opened_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "escalated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "resolved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "resolved_by_user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "resolution_notes",
            sa.Text(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_operational_exceptions_exception_type",
        "operational_exceptions",
        ["exception_type"],
    )

    op.create_index(
        "ix_operational_exceptions_status",
        "operational_exceptions",
        ["status"],
    )

    op.create_index(
        "ix_operational_exceptions_source_type",
        "operational_exceptions",
        ["source_type"],
    )

    op.create_index(
        "ix_operational_exceptions_source_id",
        "operational_exceptions",
        ["source_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_operational_exceptions_source_id",
        table_name="operational_exceptions",
    )

    op.drop_index(
        "ix_operational_exceptions_source_type",
        table_name="operational_exceptions",
    )

    op.drop_index(
        "ix_operational_exceptions_status",
        table_name="operational_exceptions",
    )

    op.drop_index(
        "ix_operational_exceptions_exception_type",
        table_name="operational_exceptions",
    )

    op.drop_table(
        "operational_exceptions"
    )

    op.execute(
        "DROP TYPE operationalexceptionstatus"
    )

    op.execute(
        "DROP TYPE operationalexceptiontype"
    )