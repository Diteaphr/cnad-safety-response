"""add must_change_password to users

Revision ID: 0011
Revises: 20260516_0010
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "20260516_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
