"""Normalize user–department: junction table; drop users.department_id and users.manager_id

Revision ID: 20260516_0010
Revises: 20260515_0009

- user_departments(user_id, department_id, is_primary): org membership (one primary per user).
- Migrate from users.department_id into user_departments (is_primary=true).
- Drop users.manager_id and users.department_id; supervisor scope derives from departments.manager_id + tree.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260516_0010"
down_revision: Union[str, None] = "20260515_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUIDC = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "user_departments",
        sa.Column("user_department_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("user_id", UUIDC, sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "department_id",
            UUIDC,
            sa.ForeignKey("departments.department_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("user_id", "department_id", name="uq_user_departments_user_dept"),
    )
    op.create_index("ix_user_departments_user_id", "user_departments", ["user_id"])
    op.create_index("ix_user_departments_department_id", "user_departments", ["department_id"])
    op.create_index(
        "uq_user_departments_one_primary_per_user",
        "user_departments",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )

    op.execute(
        sa.text("""
            INSERT INTO user_departments (user_department_id, user_id, department_id, is_primary)
            SELECT gen_random_uuid(), user_id, department_id, true
            FROM users
            WHERE department_id IS NOT NULL
        """)
    )

    op.drop_index("ix_users_manager_id", table_name="users")
    op.drop_constraint("fk_users_manager_id", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")

    op.drop_index("ix_users_department_id", table_name="users")
    op.drop_constraint("fk_users_department_id", "users", type_="foreignkey")
    op.drop_column("users", "department_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("department_id", UUIDC, nullable=True))
    op.add_column("users", sa.Column("manager_id", UUIDC, nullable=True))
    op.create_foreign_key(
        "fk_users_department_id",
        "users",
        "departments",
        ["department_id"],
        ["department_id"],
        use_alter=True,
    )
    op.create_foreign_key(
        "fk_users_manager_id",
        "users",
        "users",
        ["manager_id"],
        ["user_id"],
    )
    op.create_index("ix_users_department_id", "users", ["department_id"])
    op.create_index("ix_users_manager_id", "users", ["manager_id"])

    op.execute(
        sa.text("""
            UPDATE users u
            SET department_id = ud.department_id
            FROM user_departments ud
            WHERE ud.user_id = u.user_id AND ud.is_primary = true
        """)
    )

    op.drop_index("uq_user_departments_one_primary_per_user", table_name="user_departments")
    op.drop_index("ix_user_departments_department_id", table_name="user_departments")
    op.drop_index("ix_user_departments_user_id", table_name="user_departments")
    op.drop_table("user_departments")
