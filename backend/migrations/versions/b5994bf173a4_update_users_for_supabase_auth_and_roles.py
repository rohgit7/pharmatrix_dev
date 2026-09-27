from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b5994bf173a4"
down_revision: Union[str, Sequence[str], None] = "e2c7b16ce7c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ---------------------------------------------------------
    # 1. Create the PostgreSQL enum type
    # ---------------------------------------------------------

    user_role_enum = postgresql.ENUM(
        "ADMIN",
        "DRIVER",
        "CUSTOMER",
        "FACILITY",
        name="userrole",
    )

    user_role_enum.create(
        op.get_bind(),
        checkfirst=True,
    )

    # ---------------------------------------------------------
    # 2. Add Supabase Auth user ID
    # ---------------------------------------------------------

    op.add_column(
        "users",
        sa.Column(
            "auth_user_id",
            sa.String(length=100),
            nullable=False,
        ),
    )

    # ---------------------------------------------------------
    # 3. Make auth_user_id unique
    # ---------------------------------------------------------

    op.create_index(
        "ix_users_auth_user_id",
        "users",
        ["auth_user_id"],
        unique=True,
    )

    # ---------------------------------------------------------
    # 4. Convert role from VARCHAR to PostgreSQL ENUM
    # ---------------------------------------------------------

    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(length=50),
        type_=user_role_enum,
        existing_nullable=False,
        postgresql_using="role::text::userrole",
    )


def downgrade() -> None:

    # ---------------------------------------------------------
    # 1. Convert enum back to VARCHAR
    # ---------------------------------------------------------

    op.alter_column(
        "users",
        "role",
        existing_type=postgresql.ENUM(
            "ADMIN",
            "DRIVER",
            "CUSTOMER",
            "FACILITY",
            name="userrole",
        ),
        type_=sa.String(length=50),
        existing_nullable=False,
        postgresql_using="role::text",
    )

    # ---------------------------------------------------------
    # 2. Remove unique index
    # ---------------------------------------------------------

    op.drop_index(
        "ix_users_auth_user_id",
        table_name="users",
    )

    # ---------------------------------------------------------
    # 3. Remove auth_user_id
    # ---------------------------------------------------------

    op.drop_column(
        "users",
        "auth_user_id",
    )

    # ---------------------------------------------------------
    # 4. Remove PostgreSQL enum type
    # ---------------------------------------------------------

    user_role_enum = postgresql.ENUM(
        "ADMIN",
        "DRIVER",
        "CUSTOMER",
        "FACILITY",
        name="userrole",
    )

    user_role_enum.drop(
        op.get_bind(),
        checkfirst=True,
    )