"""add setup_guide_completed to users

Revision ID: 0015
Revises: 20260523_0014
"""
from alembic import op
import sqlalchemy as sa

revision = "0015"
down_revision = "20260523_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("setup_guide_completed", sa.Boolean(), nullable=False, server_default="false"),
    )
    # Existing accounts skip the new first-login wizard.
    op.execute("UPDATE users SET setup_guide_completed = true")


def downgrade() -> None:
    op.drop_column("users", "setup_guide_completed")
