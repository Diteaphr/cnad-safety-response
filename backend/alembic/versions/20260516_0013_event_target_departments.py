"""Add event_target_departments join table

Revision ID: 0013
Revises: 0012

- event_target_departments(event_id, department_id): which departments an event targets.
- Empty = company-wide (all employees).
- Both FK sides cascade on delete so join rows are cleaned up automatically.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUIDC = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "event_target_departments",
        sa.Column(
            "event_id",
            UUIDC,
            sa.ForeignKey("events.event_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "department_id",
            UUIDC,
            sa.ForeignKey("departments.department_id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )
    op.create_index(
        "ix_event_target_depts_event_id", "event_target_departments", ["event_id"]
    )
    op.create_index(
        "ix_event_target_depts_dept_id", "event_target_departments", ["department_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_event_target_depts_dept_id", table_name="event_target_departments")
    op.drop_index("ix_event_target_depts_event_id", table_name="event_target_departments")
    op.drop_table("event_target_departments")
