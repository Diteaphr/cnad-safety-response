"""add users.manager_id for org hierarchy (matches frontend)

Revision ID: 20260430_0002
Revises: 20260429_0001
Create Date: 2026-04-30

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260430_0002"
down_revision: Union[str, None] = "20260429_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUIDC = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("manager_id", UUIDC, nullable=True),
    )
    op.create_foreign_key(
        "fk_users_manager_id",
        "users",
        "users",
        ["manager_id"],
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_manager_id", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")
