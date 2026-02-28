"""Drop unique constraint for cashier.inn

Revision ID: c8b2d1f4a6e9
Revises: 7c12f6a4e8d1
Create Date: 2026-02-20 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c8b2d1f4a6e9"
down_revision = "7c12f6a4e8d1"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    constraint_names: set[str] = set()
    for constraint in inspector.get_unique_constraints("cashier"):
        if constraint.get("column_names") == ["inn"] and constraint.get("name"):
            constraint_names.add(constraint["name"])

    if not constraint_names:
        constraint_names.add("cashier_inn_key")

    for name in constraint_names:
        op.execute(sa.text(f'ALTER TABLE cashier DROP CONSTRAINT IF EXISTS "{name}"'))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    has_unique_for_inn = any(
        c.get("column_names") == ["inn"] for c in inspector.get_unique_constraints("cashier")
    )
    if not has_unique_for_inn:
        op.create_unique_constraint("cashier_inn_key", "cashier", ["inn"])
