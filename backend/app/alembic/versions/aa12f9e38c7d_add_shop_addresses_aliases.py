"""Add shop addresses aliases table

Revision ID: aa12f9e38c7d
Revises: c8b2d1f4a6e9
Create Date: 2026-03-01 19:30:00.000000

"""

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "aa12f9e38c7d"
down_revision = "c8b2d1f4a6e9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "shop_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shop_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("address_raw", sa.String(), nullable=False),
        sa.Column("address_normalized", sa.String(), nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("seen_count", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "shop_id",
            "address_normalized",
            name="uq_shop_addresses_shop_normalized",
        ),
    )
    op.create_index("ix_shop_addresses_is_primary", "shop_addresses", ["is_primary"], unique=False)
    op.create_index("ix_shop_addresses_shop_id", "shop_addresses", ["shop_id"], unique=False)
    op.create_index(
        "ix_shop_addresses_shop_primary",
        "shop_addresses",
        ["shop_id", "is_primary"],
        unique=False,
    )
    bind = op.get_bind()
    shops_rows = bind.execute(
        sa.text(
            """
            SELECT id, address
            FROM shops
            WHERE address IS NOT NULL AND trim(address) <> ''
            """
        )
    ).fetchall()
    if shops_rows:
        addresses_table = sa.table(
            "shop_addresses",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("shop_id", postgresql.UUID(as_uuid=True)),
            sa.column("address_raw", sa.String),
            sa.column("address_normalized", sa.String),
            sa.column("first_seen_at", sa.DateTime(timezone=True)),
            sa.column("last_seen_at", sa.DateTime(timezone=True)),
            sa.column("seen_count", sa.Integer),
            sa.column("is_primary", sa.Boolean),
        )
        now_stmt = sa.text("SELECT now()")
        now_value = bind.execute(now_stmt).scalar_one()
        op.bulk_insert(
            addresses_table,
            [
                {
                    "id": uuid.uuid4(),
                    "shop_id": row.id,
                    "address_raw": row.address,
                    "address_normalized": " ".join(row.address.strip().split()).lower(),
                    "first_seen_at": now_value,
                    "last_seen_at": now_value,
                    "seen_count": 1,
                    "is_primary": True,
                }
                for row in shops_rows
            ],
        )


def downgrade():
    op.drop_index("ix_shop_addresses_shop_primary", table_name="shop_addresses")
    op.drop_index("ix_shop_addresses_shop_id", table_name="shop_addresses")
    op.drop_index("ix_shop_addresses_is_primary", table_name="shop_addresses")
    op.drop_table("shop_addresses")
