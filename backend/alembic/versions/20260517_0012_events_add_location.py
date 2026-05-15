"""add location to events

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("location", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("events", "location")
