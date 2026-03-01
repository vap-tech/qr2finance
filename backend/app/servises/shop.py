import logging
import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, delete, select

from app.models import (
    Shop,
    ShopCategory,
    ShopCategoryLink,
    ShopCreate,
    ShopOwnerPublic,
    ShopPublic,
)

logger = logging.getLogger(__name__)


def _clean(s: str) -> str:
    return s.strip()


def _activate_shop(shop: Shop, *, shop_owner_id: uuid.UUID | None) -> bool:
    changed = False
    if not shop.is_active:
        shop.is_active = True
        changed = True
    if shop_owner_id and shop.shop_owner_id is None:
        shop.shop_owner_id = shop_owner_id
        changed = True
    return changed


def _build_shop_public(
    *,
    shop: Shop,
    category_ids: list[uuid.UUID],
) -> ShopPublic:
    shop_owner = (
        ShopOwnerPublic.model_validate(shop.shop_owner) if shop.shop_owner else None
    )

    return ShopPublic(
        id=shop.id,
        retail_name=shop.retail_name,
        address=shop.address,
        is_favorite=shop.is_favorite,
        notes=shop.notes,
        is_active=shop.is_active,
        shop_owner_id=shop.shop_owner_id,
        shop_owner=shop_owner,
        category_ids=category_ids,
        has_name_duplicate=shop.has_name_duplicate,
        has_address_duplicate=shop.has_address_duplicate,
    )


def rescan_shop_name_duplicates(
    session: Session,
    *,
    owner_id: uuid.UUID,
) -> tuple[int, int]:
    shops = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == owner_id,
            col(Shop.is_active).is_(True),
        )
    ).all()

    counts: dict[str, int] = {}
    for shop in shops:
        counts[shop.retail_name] = counts.get(shop.retail_name, 0) + 1

    marked = 0
    for shop in shops:
        has_dup = counts.get(shop.retail_name, 0) > 1
        if has_dup:
            marked += 1
        shop.has_name_duplicate = has_dup
        session.add(shop)

    session.flush()
    return len(shops), marked


def rescan_shop_address_duplicates(
    session: Session,
    *,
    owner_id: uuid.UUID,
) -> tuple[int, int]:
    shops = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == owner_id,
            col(Shop.is_active).is_(True),
        )
    ).all()

    counts: dict[str, int] = {}
    for shop in shops:
        counts[shop.address] = counts.get(shop.address, 0) + 1

    marked = 0
    for shop in shops:
        has_dup = counts.get(shop.address, 0) > 1
        if has_dup:
            marked += 1
        shop.has_address_duplicate = has_dup
        session.add(shop)

    session.flush()
    return len(shops), marked


def get_or_create_shop(
    session: Session, *, owner_id: uuid.UUID, shop_in: ShopCreate
) -> Shop | None:
    if not shop_in.retail_name or not shop_in.address:
        return None

    retail_name = _clean(shop_in.retail_name)
    address = _clean(shop_in.address)
    if retail_name == "" or address == "":
        return None

    existing = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == owner_id,
            col(Shop.retail_name) == retail_name,
            col(Shop.address) == address,
        )
    ).one_or_none()

    if existing is not None:
        changed = _activate_shop(existing, shop_owner_id=shop_in.shop_owner_id)
        if changed:
            session.add(existing)
        session.flush()
        return existing

    stmt = (
        insert(Shop)
        .values(
            owner_id=owner_id,
            shop_owner_id=shop_in.shop_owner_id,
            retail_name=retail_name,
            address=address,
            notes=shop_in.notes,
            is_favorite=shop_in.is_favorite,
        )
        .on_conflict_do_update(
            constraint="uq_shops_owner_retail_address",
            set_={
                "is_active": True,
            },
        )
        .returning(Shop.id)  # type: ignore
    )  # type: ignore

    shop_id = session.exec(stmt).scalar_one()
    shop = session.exec(select(Shop).where(Shop.id == shop_id)).one()
    session.flush()
    return shop


def get_shop_read(
    session: Session, *, owner_id: uuid.UUID, shop_id: uuid.UUID
) -> ShopPublic:
    shop = session.exec(
        select(Shop).where(Shop.id == shop_id, Shop.owner_id == owner_id)
    ).one()

    cat_ids = session.exec(
        select(ShopCategoryLink.category_id).where(
            ShopCategoryLink.owner_id == owner_id,
            ShopCategoryLink.shop_id == shop_id,
        )
    ).all()

    return _build_shop_public(shop=shop, category_ids=list(cat_ids))


def set_shop_categories(
    session: Session,
    *,
    owner_id: uuid.UUID,
    shop_id: uuid.UUID,
    category_ids: list[uuid.UUID],
) -> None:
    category_ids = list(dict.fromkeys(category_ids))

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
            raise ValueError(f"Some categories not found: {missing}")

    session.exec(
        delete(ShopCategoryLink).where(
            col(ShopCategoryLink.owner_id) == owner_id,
            col(ShopCategoryLink.shop_id) == shop_id,
        )
    )  # type: ignore

    if category_ids:
        values = [
            {
                "owner_id": owner_id,
                "shop_id": shop_id,
                "category_id": cid,
            }
            for cid in category_ids
        ]
        stmt = insert(ShopCategoryLink).values(values)
        session.exec(stmt)

    session.commit()
