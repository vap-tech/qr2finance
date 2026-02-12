"""Drop is_active from shop_category_links

Revision ID: 3f4b0e2f9a11
Revises: fe56fa70289e
Create Date: 2026-02-12 03:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3f4b0e2f9a11'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('shop_category_links', 'is_active')


def downgrade():
    op.add_column(
        'shop_category_links',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.alter_column('shop_category_links', 'is_active', server_default=None)
