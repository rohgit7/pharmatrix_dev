"""add customer codes and public UUIDs

Revision ID: 6230fd4daae0
Revises: 4b139d099072
Create Date: 2026-10-12 19:59:14.615989
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# Revision identifiers
revision: str = "6230fd4daae0"
down_revision: Union[str, Sequence[str], None] = "4b139d099072"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create a sequence for customer codes.
    op.execute(
        "CREATE SEQUENCE public.customer_code_seq "
        "START WITH 1 INCREMENT BY 1"
    )

    # 2. Add new columns as nullable first, allowing safe backfilling.
    op.add_column(
        "customers",
        sa.Column("customer_code", sa.String(length=20), nullable=True),
        schema="public",
    )

    for table in (
        "customers",
        "pickups",
        "invoices",
        "disposal_certificates",
    ):
        op.add_column(
            table,
            sa.Column(
                "public_id",
                postgresql.UUID(as_uuid=True),
                nullable=True,
            ),
            schema="public",
        )

    # 3. Backfill customer codes deterministically.
    op.execute(
        """
        WITH numbered AS (
            SELECT
                id,
                ROW_NUMBER() OVER (ORDER BY id) AS row_num
            FROM public.customers
            WHERE customer_code IS NULL
        )
        UPDATE public.customers AS c
        SET customer_code =
            'CUS-' || LPAD(numbered.row_num::text, 6, '0')
        FROM numbered
        WHERE c.id = numbered.id
        """
    )

    # Make future customer codes use the sequence.
    op.execute(
        """
        SELECT setval(
            'public.customer_code_seq',
            GREATEST((SELECT COUNT(*) FROM public.customers), 1),
            (SELECT COUNT(*) > 0 FROM public.customers)
        )
        """
    )

    op.alter_column(
        "customers",
        "customer_code",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text(
            "'CUS-' || LPAD("
            "nextval('public.customer_code_seq')::text, 6, '0')"
        ),
        schema="public",
    )

    # 4. Generate UUIDs for existing records.
    for table in (
        "customers",
        "pickups",
        "invoices",
        "disposal_certificates",
    ):
        op.execute(
            sa.text(
                f"""
                UPDATE public.{table}
                SET public_id = gen_random_uuid()
                WHERE public_id IS NULL
                """
            )
        )

        op.alter_column(
            table,
            "public_id",
            existing_type=postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
            schema="public",
        )

    # 5. Enforce uniqueness.
    op.create_unique_constraint(
        "uq_customers_customer_code",
        "customers",
        ["customer_code"],
        schema="public",
    )

    for table in (
        "customers",
        "pickups",
        "invoices",
        "disposal_certificates",
    ):
        op.create_unique_constraint(
            f"uq_{table}_public_id",
            table,
            ["public_id"],
            schema="public",
        )


def downgrade() -> None:
    # Remove only objects created by this migration.
    for table in (
        "disposal_certificates",
        "invoices",
        "pickups",
        "customers",
    ):
        op.drop_constraint(
            f"uq_{table}_public_id",
            table,
            type_="unique",
            schema="public",
        )

    op.drop_constraint(
        "uq_customers_customer_code",
        "customers",
        type_="unique",
        schema="public",
    )

    for table in (
        "disposal_certificates",
        "invoices",
        "pickups",
        "customers",
    ):
        op.drop_column(table, "public_id", schema="public")

    op.drop_column("customers", "customer_code", schema="public")

    op.execute("DROP SEQUENCE public.customer_code_seq")