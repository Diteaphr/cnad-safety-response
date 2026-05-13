"""rename event_type -> event_types (table name convention)

Revision ID: 20260506_0006
Revises: 20260505_0005
Create Date: 2026-05-06

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260506_0006"
down_revision: Union[str, None] = "20260505_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("event_type", "event_types")


def downgrade() -> None:
    op.rename_table("event_types", "event_type")
