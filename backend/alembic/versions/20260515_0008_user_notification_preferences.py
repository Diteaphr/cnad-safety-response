"""user_notification_preferences: per-user push channel toggles

Revision ID: 20260515_0008
Revises: 20260514_0007
Create Date: 2026-05-15

Stores master push switch plus emergency / status reminder / escalation channels.
One row per user (PK = user_id); existing users are backfilled with all toggles ON.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260515_0008"
down_revision: Union[str, None] = "20260514_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notification_preferences",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "push_master_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "push_emergency_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "push_reminder_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "push_escalation_enabled",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.user_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO user_notification_preferences (
                user_id,
                push_master_enabled,
                push_emergency_enabled,
                push_reminder_enabled,
                push_escalation_enabled
            )
            SELECT user_id, true, true, true, true FROM users
            """
        )
    )


def downgrade() -> None:
    op.drop_table("user_notification_preferences")
