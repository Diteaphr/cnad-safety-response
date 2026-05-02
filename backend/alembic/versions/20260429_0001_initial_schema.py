"""initial schema: core tables, constraints, indexes

Revision ID: 20260429_0001
Revises:
Create Date: 2026-04-29

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260429_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUIDC = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("role_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("role_name", sa.String(), nullable=False),
        sa.UniqueConstraint("role_name", name="uq_roles_role_name"),
    )

    op.create_table(
        "departments",
        sa.Column("department_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("department_name", sa.String(), nullable=False),
        sa.Column("parent_department_id", UUIDC, nullable=True),
        sa.Column("manager_id", UUIDC, nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_department_id"],
            ["departments.department_id"],
            name="fk_departments_parent",
        ),
    )

    op.create_table(
        "users",
        sa.Column("user_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("employee_no", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("department_id", UUIDC, nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.UniqueConstraint("employee_no", name="uq_users_employee_no"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["departments.department_id"],
            name="fk_users_department_id",
        ),
    )

    op.create_foreign_key(
        "fk_departments_manager_id",
        "departments",
        "users",
        ["manager_id"],
        ["user_id"],
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", UUIDC, nullable=False),
        sa.Column("role_id", UUIDC, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.role_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
    )

    op.create_table(
        "events",
        sa.Column("event_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("created_by", UUIDC, nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.user_id"]),
    )

    op.create_table(
        "event_departments",
        sa.Column("event_department_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("event_id", UUIDC, nullable=False),
        sa.Column("department_id", UUIDC, nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.event_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["department_id"], ["departments.department_id"], ondelete="CASCADE"
        ),
    )

    op.create_table(
        "safety_responses",
        sa.Column("response_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("event_id", UUIDC, nullable=False),
        sa.Column("user_id", UUIDC, nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column(
            "responded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["event_id"], ["events.event_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "event_id",
            "user_id",
            name="uq_safety_responses_event_user",
        ),
    )

    op.create_table(
        "notifications",
        sa.Column("notification_id", UUIDC, primary_key=True, nullable=False),
        sa.Column("event_id", UUIDC, nullable=False),
        sa.Column("user_id", UUIDC, nullable=False),
        sa.Column("channel", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["events.event_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "event_id",
            "user_id",
            "channel",
            name="uq_notifications_event_user_channel",
        ),
    )

    op.create_index(
        "ix_users_department_id", "users", ["department_id"], unique=False
    )
    op.create_index("ix_events_status", "events", ["status"], unique=False)
    op.create_index(
        "ix_event_departments_event_id",
        "event_departments",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        "ix_event_departments_department_id",
        "event_departments",
        ["department_id"],
        unique=False,
    )
    op.create_index(
        "ix_safety_responses_event_id",
        "safety_responses",
        ["event_id"],
        unique=False,
    )
    op.create_index(
        "ix_safety_responses_user_id",
        "safety_responses",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_event_id", "notifications", ["event_id"], unique=False
    )
    op.create_index(
        "ix_notifications_user_id", "notifications", ["user_id"], unique=False
    )
    op.create_index(
        "ix_notifications_status", "notifications", ["status"], unique=False
    )

    op.execute(
        sa.text(
            """
            INSERT INTO roles (role_id, role_name) VALUES
              (gen_random_uuid(), 'admin'),
              (gen_random_uuid(), 'supervisor'),
              (gen_random_uuid(), 'employee')
            ON CONFLICT (role_name) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_status", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_event_id", table_name="notifications")
    op.drop_index("ix_safety_responses_user_id", table_name="safety_responses")
    op.drop_index("ix_safety_responses_event_id", table_name="safety_responses")
    op.drop_index(
        "ix_event_departments_department_id", table_name="event_departments"
    )
    op.drop_index("ix_event_departments_event_id", table_name="event_departments")
    op.drop_index("ix_events_status", table_name="events")
    op.drop_index("ix_users_department_id", table_name="users")

    op.drop_table("notifications")
    op.drop_table("safety_responses")
    op.drop_table("event_departments")
    op.drop_table("events")
    op.drop_table("user_roles")
    op.drop_constraint(
        "fk_departments_manager_id", "departments", type_="foreignkey"
    )
    op.drop_table("users")
    op.drop_table("departments")
    op.drop_table("roles")
