"""add nullable password_hash on users for email/password auth

Revision ID: 20260502_0003
Revises: 20260430_0002
Create Date: 2026-05-02

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260502_0003"
down_revision: Union[str, None] = "20260430_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_hash", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_hash")
