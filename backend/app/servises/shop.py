import logging
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, delete, select

from app.models import (
    Shop,
    ShopAddress,
    ShopAddressPublic,
    ShopCategory,
    ShopCategoryLink,
    ShopCreate,
    ShopOwnerPublic,
    ShopPrimaryAddressUpdate,
    ShopPublic,
    get_datetime_utc,
)

logger = logging.getLogger(__name__)


def _clean(s: str) -> str:
    return s.strip()


def normalize_shop_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def normalize_shop_address(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def list_shop_addresses(session: Session, *, shop_id: uuid.UUID) -> list[ShopAddress]:
    statement = (
        select(ShopAddress)
        .where(col(ShopAddress.shop_id) == shop_id)
        .order_by(
            col(ShopAddress.is_primary).desc(),
            col(ShopAddress.seen_count).desc(),
            col(ShopAddress.last_seen_at).desc(),
        )
    )
    return list(session.exec(statement))


def _build_shop_public(
    session: Session,
    *,
    shop: Shop,
    category_ids: list[uuid.UUID],
) -> ShopPublic:
    shop_owner = (
        ShopOwnerPublic.model_validate(shop.shop_owner) if shop.shop_owner else None
    )
    aliases = list_shop_addresses(session=session, shop_id=shop.id)
    aliases_public = [ShopAddressPublic.model_validate(item) for item in aliases]
    aliases_count = len(aliases_public)

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
        address_aliases_count=aliases_count,
        has_address_conflict=aliases_count > 1,
        addresses=aliases_public,
    )


def touch_shop_address(
    session: Session,
    *,
    shop: Shop,
    address_raw: str,
    make_primary: bool = False,
    now: datetime | None = None,
) -> ShopAddress:
    cleaned_address = _clean(address_raw)
    if cleaned_address == "":
        raise ValueError("Shop address cannot be empty")

    normalized_address = normalize_shop_address(cleaned_address)
    timestamp = now or get_datetime_utc()

    alias = session.exec(
        select(ShopAddress).where(
            col(ShopAddress.shop_id) == shop.id,
            col(ShopAddress.address_normalized) == normalized_address,
        )
    ).one_or_none()

    if alias is None:
        alias = ShopAddress(
            shop_id=shop.id,
            address_raw=cleaned_address,
            address_normalized=normalized_address,
            first_seen_at=timestamp,
            last_seen_at=timestamp,
            seen_count=1,
            is_primary=False,
        )
        session.add(alias)
        session.flush()
    else:
        alias.seen_count += 1
        alias.last_seen_at = timestamp
        alias.address_raw = cleaned_address
        session.add(alias)

    if make_primary:
        all_aliases = list_shop_addresses(session=session, shop_id=shop.id)
        for item in all_aliases:
            item.is_primary = item.id == alias.id
            session.add(item)
        shop.address = alias.address_raw
        session.add(shop)
    else:
        has_primary = session.exec(
            select(ShopAddress.id).where(
                col(ShopAddress.shop_id) == shop.id,
                col(ShopAddress.is_primary).is_(True),
            )
        ).first()
        if has_primary is None:
            alias.is_primary = True
            shop.address = alias.address_raw
            session.add(alias)
            session.add(shop)

    session.flush()
    return alias


def set_shop_primary_address(
    session: Session,
    *,
    shop: Shop,
    payload: ShopPrimaryAddressUpdate,
) -> ShopAddress:
    aliases = list_shop_addresses(session=session, shop_id=shop.id)
    selected = next((item for item in aliases if item.id == payload.alias_id), None)
    if selected is None:
        raise ValueError("Address alias not found for this shop")

    for item in aliases:
        item.is_primary = item.id == payload.alias_id
        session.add(item)

    shop.address = selected.address_raw
    session.add(shop)
    session.flush()
    return selected


def split_shop_by_address_alias(
    session: Session,
    *,
    shop: Shop,
    alias_id: uuid.UUID,
) -> Shop:
    alias = session.exec(
        select(ShopAddress).where(
            col(ShopAddress.shop_id) == shop.id,
            col(ShopAddress.id) == alias_id,
        )
    ).one_or_none()
    if alias is None:
        raise ValueError("Address alias not found for this shop")

    existing = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == shop.owner_id,
            col(Shop.retail_name) == shop.retail_name,
            col(Shop.address) == alias.address_raw,
        )
    ).one_or_none()
    if existing is not None:
        return existing

    new_shop = Shop(
        owner_id=shop.owner_id,
        shop_owner_id=shop.shop_owner_id,
        retail_name=shop.retail_name,
        address=alias.address_raw,
        is_favorite=False,
        notes=shop.notes,
        is_active=True,
    )
    session.add(new_shop)
    session.flush()

    touch_shop_address(
        session=session,
        shop=new_shop,
        address_raw=alias.address_raw,
        make_primary=True,
    )

    return new_shop


def get_or_create_shop(
    session: Session, *, owner_id: uuid.UUID, shop_in: ShopCreate
) -> Shop | None:
    """Get existing shop or create one.

    Rules:
    - exact retail_name + address -> return that shop;
    - same retail_name but different address -> return existing shop by name and
      record new address as alias (address conflict for later manual resolve);
    - no name match -> create new shop.
    """
    if not shop_in.retail_name or not shop_in.address:
        return None

    retail_name = _clean(shop_in.retail_name)
    address = _clean(shop_in.address)
    if retail_name == "" or address == "":
        return None

    exact_shop = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == owner_id,
            col(Shop.retail_name) == retail_name,
            col(Shop.address) == address,
        )
    ).one_or_none()
    if exact_shop is not None:
        exact_shop.is_active = True
        if shop_in.shop_owner_id and exact_shop.shop_owner_id is None:
            exact_shop.shop_owner_id = shop_in.shop_owner_id
        session.add(exact_shop)
        touch_shop_address(
            session=session,
            shop=exact_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return exact_shop

    normalized_name = normalize_shop_name(retail_name)
    same_name_shop = None
    rows = session.exec(
        select(Shop)
        .where(col(Shop.owner_id) == owner_id)
        .order_by(col(Shop.is_active).desc(), col(Shop.id).asc())
    ).all()
    for row in rows:
        if normalize_shop_name(row.retail_name) == normalized_name:
            same_name_shop = row
            break

    if same_name_shop is not None:
        same_name_shop.is_active = True
        if shop_in.shop_owner_id and same_name_shop.shop_owner_id is None:
            same_name_shop.shop_owner_id = shop_in.shop_owner_id
        session.add(same_name_shop)
        touch_shop_address(
            session=session,
            shop=same_name_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return same_name_shop

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
    created = session.exec(select(Shop).where(Shop.id == shop_id)).one()
    touch_shop_address(
        session=session,
        shop=created,
        address_raw=address,
        make_primary=True,
    )
    session.flush()
    return created


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

    return _build_shop_public(session=session, shop=shop, category_ids=list(cat_ids))


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
