"""event_types lookup table; events.event_type_id FK

Revision ID: 20260504_0004
Revises: 20260502_0003
Create Date: 2026-05-04

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260504_0004"
down_revision: Union[str, None] = "20260502_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUIDC = postgresql.UUID(as_uuid=True)

# Must match app.seeding.ids ET_*
ET_EARTHQUAKE = "d0000001-0000-4000-8000-000000000001"
ET_TYPHOON = "d0000001-0000-4000-8000-000000000002"
ET_FIRE = "d0000001-0000-4000-8000-000000000003"
ET_OTHER = "d0000001-0000-4000-8000-000000000004"


def upgrade() -> None:
    op.create_table(
        "event_types",
        sa.Column("event_type_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.UniqueConstraint("code", name="uq_event_types_code"),
    )
    op.execute(
        sa.text(
            f"""
            INSERT INTO event_types (event_type_id, code, name) VALUES
              ('{ET_EARTHQUAKE}'::uuid, 'earthquake', 'Earthquake'),
              ('{ET_TYPHOON}'::uuid, 'typhoon', 'Typhoon'),
              ('{ET_FIRE}'::uuid, 'fire', 'Fire'),
              ('{ET_OTHER}'::uuid, 'other', 'Other')
            """
        )
    )

    op.add_column(
        "events",
        sa.Column("event_type_id", UUIDC, nullable=True),
    )
    op.create_foreign_key(
        "fk_events_event_type_id",
        "events",
        "event_types",
        ["event_type_id"],
        ["event_type_id"],
    )

    op.execute(
        sa.text(
            """
            UPDATE events AS e
            SET event_type_id = et.event_type_id
            FROM event_types AS et
            WHERE lower(trim(e.event_type)) = lower(et.name)
               OR lower(trim(e.event_type)) = et.code
            """
        )
    )
    op.execute(
        sa.text(
            f"""
            UPDATE events
            SET event_type_id = '{ET_OTHER}'::uuid
            WHERE event_type_id IS NULL
            """
        )
    )

    op.alter_column("events", "event_type_id", nullable=False)
    op.drop_column("events", "event_type")


def downgrade() -> None:
    op.add_column(
        "events",
        sa.Column("event_type", sa.String(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE events AS e
            SET event_type = et.name
            FROM event_types AS et
            WHERE e.event_type_id = et.event_type_id
            """
        )
    )
    op.alter_column("events", "event_type", nullable=False)

    op.drop_constraint("fk_events_event_type_id", "events", type_="foreignkey")
    op.drop_column("events", "event_type_id")
    op.drop_table("event_types")
