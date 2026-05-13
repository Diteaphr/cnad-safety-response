"""rename event_types -> event_type (align with event_type_id FK naming)

Revision ID: 20260505_0005
Revises: 20260504_0004
Create Date: 2026-05-05

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "20260505_0005"
down_revision: Union[str, None] = "20260504_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("event_types", "event_type")


def downgrade() -> None:
    op.rename_table("event_type", "event_types")
