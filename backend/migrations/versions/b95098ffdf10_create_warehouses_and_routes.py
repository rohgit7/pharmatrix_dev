"""create warehouses and routes

Revision ID: b95098ffdf10
Revises: 7d76d05caba7
Create Date: 2026-09-27 19:23:26.878119

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b95098ffdf10"
down_revision: Union[str, Sequence[str], None] = "7d76d05caba7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ------------------------------------------------------------------
    # WAREHOUSES
    # ------------------------------------------------------------------
    op.create_table(
        "warehouses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=100), nullable=False),
        sa.Column("postal_code", sa.String(length=20), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
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
        sa.UniqueConstraint("code"),
    )

    # ------------------------------------------------------------------
    # ROUTES
    # ------------------------------------------------------------------
    op.create_table(
        "routes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("route_code", sa.String(length=50), nullable=False),
        sa.Column(
            "route_date",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "driver_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "vehicle_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "DRAFT",
                "OPTIMIZING",
                "READY",
                "ASSIGNED",
                "IN_PROGRESS",
                "COMPLETED",
                "CANCELLED",
                name="routestatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "planned_distance_km",
            sa.Numeric(precision=10, scale=2),
            nullable=True,
        ),
        sa.Column(
            "planned_duration_seconds",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "optimized_at",
            sa.DateTime(timezone=True),
            nullable=True,
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
        sa.ForeignKeyConstraint(
            ["driver_id"],
            ["drivers.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["vehicle_id"],
            ["vehicles.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["warehouse_id"],
            ["warehouses.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("route_code"),
    )

    op.create_index(
        op.f("ix_routes_driver_id"),
        "routes",
        ["driver_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_routes_vehicle_id"),
        "routes",
        ["vehicle_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_routes_warehouse_id"),
        "routes",
        ["warehouse_id"],
        unique=False,
    )

    # ------------------------------------------------------------------
    # ROUTE STOPS
    # ------------------------------------------------------------------
    op.create_table(
        "route_stops",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "route_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "sequence_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "stop_type",
            sa.Enum(
                "PICKUP",
                "WAREHOUSE",
                name="routestoptype",
            ),
            nullable=False,
        ),
        sa.Column(
            "pickup_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "warehouse_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "arrival_time",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "departure_time",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # A pickup stop must reference a pickup.
        # A warehouse stop must reference a warehouse.
        sa.CheckConstraint(
            """
            (
                stop_type = 'PICKUP'
                AND pickup_id IS NOT NULL
                AND warehouse_id IS NULL
            )
            OR
            (
                stop_type = 'WAREHOUSE'
                AND pickup_id IS NULL
                AND warehouse_id IS NOT NULL
            )
            """,
            name="ck_route_stops_type_reference",
        ),

        # Sequence numbers must start from 1.
        sa.CheckConstraint(
            "sequence_number > 0",
            name="ck_route_stops_sequence_positive",
        ),

        sa.ForeignKeyConstraint(
            ["pickup_id"],
            ["pickups.id"],
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            ["route_id"],
            ["routes.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["warehouse_id"],
            ["warehouses.id"],
            ondelete="RESTRICT",
        ),

        sa.PrimaryKeyConstraint("id"),

        # A pickup can belong to only one route stop.
        sa.UniqueConstraint("pickup_id"),

        # A route cannot have two stops with the same sequence number.
        sa.UniqueConstraint(
            "route_id",
            "sequence_number",
            name="uq_route_stops_route_sequence",
        ),
    )

    op.create_index(
        op.f("ix_route_stops_route_id"),
        "route_stops",
        ["route_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f("ix_route_stops_route_id"),
        table_name="route_stops",
    )

    op.drop_table("route_stops")

    op.drop_index(
        op.f("ix_routes_warehouse_id"),
        table_name="routes",
    )

    op.drop_index(
        op.f("ix_routes_vehicle_id"),
        table_name="routes",
    )

    op.drop_index(
        op.f("ix_routes_driver_id"),
        table_name="routes",
    )

    op.drop_table("routes")

    op.drop_table("warehouses")