"""add fcm_token to users

Revision ID: 20260523_0014
Revises: 0013
Create Date: 2026-05-23
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260523_0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("fcm_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "fcm_token")
