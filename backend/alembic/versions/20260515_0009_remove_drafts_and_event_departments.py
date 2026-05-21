"""Remove draft events, drop event_departments, constrain event status

Revision ID: 20260515_0009
Revises: 20260515_0008

- DELETE events with status = 'draft' (CASCADE removes dependent rows).
- DROP TABLE event_departments — event scope is company-wide (handled in app).
- ADD CHECK so events.status is only 'active' or 'closed'.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260515_0009"
down_revision: Union[str, None] = "20260515_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM events WHERE status = 'draft'"))
    op.drop_table("event_departments")
    op.create_check_constraint(
        "ck_events_status_active_or_closed",
        "events",
        sa.text("status IN ('active', 'closed')"),
    )


def downgrade() -> None:
    op.drop_constraint("ck_events_status_active_or_closed", "events", type_="check")
    op.create_table(
        "event_departments",
        sa.Column(
            "event_department_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.event_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.department_id", ondelete="CASCADE"),
            nullable=False,
        ),
    )
    op.create_index("ix_event_departments_event_id", "event_departments", ["event_id"])
    op.create_index(
        "ix_event_departments_department_id",
        "event_departments",
        ["department_id"],
    )
