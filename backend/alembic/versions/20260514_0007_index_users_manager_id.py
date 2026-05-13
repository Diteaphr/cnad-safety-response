"""add index on users.manager_id for recursive CTE performance

Revision ID: 20260514_0007
Revises: 20260506_0006
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260514_0007"
down_revision: Union[str, None] = "20260506_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_users_manager_id", "users", ["manager_id"])


def downgrade() -> None:
    op.drop_index("ix_users_manager_id", table_name="users")
