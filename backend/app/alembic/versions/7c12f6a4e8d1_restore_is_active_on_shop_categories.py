"""Restore is_active on shop_categories if missing

Revision ID: 7c12f6a4e8d1
Revises: 3f4b0e2f9a11
Create Date: 2026-02-12 03:55:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '7c12f6a4e8d1'
down_revision = '3f4b0e2f9a11'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE shop_categories
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_shop_categories_is_active
        ON shop_categories (is_active)
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_shop_categories_is_active")
    op.execute(
        """
        ALTER TABLE shop_categories
        DROP COLUMN IF EXISTS is_active
        """
    )
