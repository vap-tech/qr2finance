import logging
import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, select

from app.models import Shop, ShopCategory, ShopCategoryLink, ShopCreate, ShopRead

logger = logging.getLogger(__name__)


def _clean(s: str) -> str:
    return s.strip()


def get_or_create_shop(
    session: Session, *, owner_id: uuid.UUID, shop_in: ShopCreate
) -> Shop | None:
    """Get an existing shop by name/address or create a new one without committing."""
    if not shop_in.retail_name or not shop_in.address:
        return None

    retail_name = _clean(shop_in.retail_name)
    address = _clean(shop_in.address)

    stmt = (
        insert(Shop)
        .values(
            owner_id=owner_id,
            retail_name=retail_name,
            address=address,
            notes=shop_in.notes,
            is_favorite=shop_in.is_favorite,
        )
        .on_conflict_do_update(
            # лучше по constraint:
            # constraint="uq_shops_owner_retail_address",
            constraint="uq_shops_owner_retail_address",
            # index_elements=[Shop.owner_id, Shop.retail_name, Shop.address],
            set_={
                "is_active": True,
            },
            where=(Shop.is_active.is_(False)),  # type: ignore
        )
        .returning(Shop.id)  # type: ignore
    )  # type: ignore

    shop_id = session.exec(stmt).one()
    session.flush()  # commit пусть делает вызывающий
    return session.exec(select(Shop).where(Shop.id == shop_id)).one()


def get_shop_read(
    session: Session, *, owner_id: uuid.UUID, shop_id: uuid.UUID
) -> ShopRead:
    shop = session.exec(
        select(Shop).where(Shop.id == shop_id, Shop.owner_id == owner_id)
    ).one()

    cat_ids = session.exec(
        select(ShopCategoryLink.category_id).where(
            ShopCategoryLink.owner_id == owner_id,
            ShopCategoryLink.shop_id == shop_id,
            ShopCategoryLink.is_active.is_(True),  # type: ignore
        )
    ).all()

    return ShopRead(
        id=shop.id,
        retail_name=shop.retail_name,
        address=shop.address,
        is_favorite=shop.is_favorite,
        notes=shop.notes,
        is_active=shop.is_active,
        category_ids=list(cat_ids),
    )


def set_shop_categories(
    session: Session,
    *,
    owner_id: uuid.UUID,
    shop_id: uuid.UUID,
    category_ids: list[uuid.UUID],
) -> None:
    # dedupe, keep order
    category_ids = list(dict.fromkeys(category_ids))

    # 1) Проверяем, что shop принадлежит owner
    shop_exists = session.exec(
        select(Shop.id).where(Shop.id == shop_id, Shop.owner_id == owner_id)
    ).first()
    if not shop_exists:
        raise ValueError("Shop not found")

    # 2) Проверяем, что все категории принадлежат owner от греха
    if category_ids:
        rows = session.exec(
            select(ShopCategory.id).where(
                ShopCategory.owner_id == owner_id,
                ShopCategory.id.in_(category_ids),  # type: ignore
                ShopCategory.is_active.is_(True),  # type: ignore
            )
        ).all()
        found = set(rows)
        missing = [cid for cid in category_ids if cid not in found]
        if missing:
            logger.info("Some categories not found: %s", missing)

    # 3) Деактивируем все связи магазина
    session.exec(
        """
        UPDATE shop_category_links
        SET is_active = false
        WHERE owner_id = :owner_id AND shop_id = :shop_id
        """,
        {"owner_id": owner_id, "shop_id": shop_id},
    )  # type: ignore

    # 4) Upsert для переданных категорий
    #    Важно: используем INSERT .. ON CONFLICT по (shop_id, category_id)
    if category_ids:
        values = [
            {
                "owner_id": owner_id,
                "shop_id": shop_id,
                "category_id": cid,
                "is_active": True,
            }
            for cid in category_ids
        ]
        stmt = (
            insert(ShopCategoryLink)
            .values(values)
            .on_conflict_do_update(
                index_elements=[ShopCategoryLink.shop_id, ShopCategoryLink.category_id],  # type: ignore
                set_={"is_active": True, "owner_id": owner_id},
            )
        )
        session.exec(stmt)

    session.commit()
