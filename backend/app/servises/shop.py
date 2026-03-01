import logging
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlmodel import Session, col, delete, select

from app.models import (
    Receipt,
    ReceiptShopAddressConflict,
    Shop,
    ShopAddress,
    ShopAddressPublic,
    ShopAddressRule,
    ShopCategory,
    ShopCategoryLink,
    ShopCreate,
    ShopOwnerPublic,
    ShopPrimaryAddressUpdate,
    ShopPublic,
    get_datetime_utc,
)

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ShopMatchResult:
    shop: Shop | None
    conflict_alias_id: uuid.UUID | None = None


def _clean(s: str) -> str:
    return s.strip()


def normalize_shop_name(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def normalize_shop_address(value: str) -> str:
    return " ".join(value.strip().split()).casefold()


def _activate_shop(shop: Shop, *, shop_owner_id: uuid.UUID | None) -> None:
    shop.is_active = True
    if shop_owner_id and shop.shop_owner_id is None:
        shop.shop_owner_id = shop_owner_id


def upsert_shop_address_rule(
    session: Session,
    *,
    owner_id: uuid.UUID,
    retail_name_normalized: str,
    address_normalized: str,
    shop_id: uuid.UUID,
) -> None:
    stmt = (
        insert(ShopAddressRule)
        .values(
            owner_id=owner_id,
            retail_name_normalized=retail_name_normalized,
            address_normalized=address_normalized,
            shop_id=shop_id,
        )
        .on_conflict_do_update(
            constraint="uq_shop_address_rules_owner_name_address",
            set_={"shop_id": shop_id},
        )
    )
    session.exec(stmt)


def resolve_shop_address_conflicts(
    session: Session,
    *,
    owner_id: uuid.UUID,
    alias_ids: list[uuid.UUID],
    target_shop_id: uuid.UUID,
) -> int:
    if not alias_ids:
        return 0

    conflicts = session.exec(
        select(ReceiptShopAddressConflict).where(
            col(ReceiptShopAddressConflict.owner_id) == owner_id,
            col(ReceiptShopAddressConflict.shop_address_id).in_(alias_ids),  # type: ignore
        )
    ).all()

    touched_receipts = 0
    for conflict in conflicts:
        receipt = session.get(Receipt, conflict.receipt_id)
        if receipt is not None and receipt.owner_id == owner_id:
            if receipt.shop_id != target_shop_id:
                receipt.shop_id = target_shop_id
                session.add(receipt)
            touched_receipts += 1
        session.delete(conflict)

    session.flush()
    return touched_receipts


def mark_receipt_shop_address_conflict(
    session: Session,
    *,
    owner_id: uuid.UUID,
    receipt_id: uuid.UUID,
    shop_id: uuid.UUID,
    shop_address_id: uuid.UUID,
) -> None:
    stmt = (
        insert(ReceiptShopAddressConflict)
        .values(
            owner_id=owner_id,
            receipt_id=receipt_id,
            shop_id=shop_id,
            shop_address_id=shop_address_id,
        )
        .on_conflict_do_nothing(
            constraint="uq_receipt_shop_addr_conflict_receipt_alias",
        )
    )
    session.exec(stmt)


def _find_shop_by_rule(
    session: Session,
    *,
    owner_id: uuid.UUID,
    retail_name_normalized: str,
    address_normalized: str,
) -> Shop | None:
    rule = session.exec(
        select(ShopAddressRule).where(
            col(ShopAddressRule.owner_id) == owner_id,
            col(ShopAddressRule.retail_name_normalized) == retail_name_normalized,
            col(ShopAddressRule.address_normalized) == address_normalized,
        )
    ).one_or_none()
    if rule is None:
        return None
    return session.get(Shop, rule.shop_id)


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
    if shop.retail_name:
        upsert_shop_address_rule(
            session=session,
            owner_id=shop.owner_id,
            retail_name_normalized=normalize_shop_name(shop.retail_name),
            address_normalized=selected.address_normalized,
            shop_id=shop.id,
        )
    resolve_shop_address_conflicts(
        session=session,
        owner_id=shop.owner_id,
        alias_ids=[selected.id],
        target_shop_id=shop.id,
    )
    session.flush()
    return selected


def split_shop_by_address_alias(
    session: Session,
    *,
    shop: Shop,
    alias_id: uuid.UUID,
) -> Shop:
    source_alias = session.exec(
        select(ShopAddress).where(
            col(ShopAddress.shop_id) == shop.id,
            col(ShopAddress.id) == alias_id,
        )
    ).one_or_none()
    if source_alias is None:
        raise ValueError("Address alias not found for this shop")
    if source_alias.is_primary:
        raise ValueError(
            "Primary address cannot be split. Set another primary address first."
        )

    target_shop = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == shop.owner_id,
            col(Shop.retail_name) == shop.retail_name,
            col(Shop.address) == source_alias.address_raw,
        )
    ).one_or_none()
    if target_shop is None:
        target_shop = Shop(
            owner_id=shop.owner_id,
            shop_owner_id=shop.shop_owner_id,
            retail_name=shop.retail_name,
            address=source_alias.address_raw,
            is_favorite=False,
            notes=shop.notes,
            is_active=True,
        )
        session.add(target_shop)
        session.flush()

    target_shop.is_active = True
    session.add(target_shop)

    # If target already has the same normalized alias, merge counters and remove source alias.
    target_alias_same_address = session.exec(
        select(ShopAddress).where(
            col(ShopAddress.shop_id) == target_shop.id,
            col(ShopAddress.address_normalized) == source_alias.address_normalized,
        )
    ).one_or_none()

    moved_alias: ShopAddress
    alias_to_delete: ShopAddress | None = None
    if (
        target_alias_same_address is not None
        and target_alias_same_address.id != source_alias.id
    ):
        target_alias_same_address.seen_count += source_alias.seen_count
        if source_alias.first_seen_at < target_alias_same_address.first_seen_at:
            target_alias_same_address.first_seen_at = source_alias.first_seen_at
        if source_alias.last_seen_at > target_alias_same_address.last_seen_at:
            target_alias_same_address.last_seen_at = source_alias.last_seen_at
        target_alias_same_address.address_raw = source_alias.address_raw
        session.add(target_alias_same_address)
        alias_to_delete = source_alias
        moved_alias = target_alias_same_address
    else:
        source_alias.shop_id = target_shop.id
        source_alias.is_primary = False
        session.add(source_alias)
        moved_alias = source_alias

    # Make moved address primary for target shop.
    target_aliases = list_shop_addresses(session=session, shop_id=target_shop.id)
    for item in target_aliases:
        item.is_primary = item.id == moved_alias.id
        session.add(item)
    target_shop.address = moved_alias.address_raw
    session.add(target_shop)

    if target_shop.retail_name:
        upsert_shop_address_rule(
            session=session,
            owner_id=target_shop.owner_id,
            retail_name_normalized=normalize_shop_name(target_shop.retail_name),
            address_normalized=moved_alias.address_normalized,
            shop_id=target_shop.id,
        )
    resolve_shop_address_conflicts(
        session=session,
        owner_id=target_shop.owner_id,
        alias_ids=[source_alias.id, moved_alias.id],
        target_shop_id=target_shop.id,
    )
    if alias_to_delete is not None:
        session.delete(alias_to_delete)

    session.flush()
    return target_shop


def match_or_create_shop(
    session: Session, *, owner_id: uuid.UUID, shop_in: ShopCreate
) -> ShopMatchResult:
    """Get existing shop or create one.

    Rules:
    - exact retail_name + address -> return that shop;
    - exact retail_name + address alias -> return that shop;
    - same retail_name but different address -> return existing shop by name and
      record new address as alias (address conflict for later manual resolve);
    - no name match -> create new shop.
    """
    if not shop_in.retail_name or not shop_in.address:
        return ShopMatchResult(shop=None)

    retail_name = _clean(shop_in.retail_name)
    address = _clean(shop_in.address)
    if retail_name == "" or address == "":
        return ShopMatchResult(shop=None)

    exact_shop = session.exec(
        select(Shop).where(
            col(Shop.owner_id) == owner_id,
            col(Shop.retail_name) == retail_name,
            col(Shop.address) == address,
        )
    ).one_or_none()
    if exact_shop is not None:
        _activate_shop(exact_shop, shop_owner_id=shop_in.shop_owner_id)
        session.add(exact_shop)
        touch_shop_address(
            session=session,
            shop=exact_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return ShopMatchResult(shop=exact_shop)

    normalized_name = normalize_shop_name(retail_name)
    normalized_address = normalize_shop_address(address)

    rule_shop = _find_shop_by_rule(
        session=session,
        owner_id=owner_id,
        retail_name_normalized=normalized_name,
        address_normalized=normalized_address,
    )
    if (
        rule_shop is not None
        and normalize_shop_name(rule_shop.retail_name or "") == normalized_name
    ):
        _activate_shop(rule_shop, shop_owner_id=shop_in.shop_owner_id)
        session.add(rule_shop)
        touch_shop_address(
            session=session,
            shop=rule_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return ShopMatchResult(shop=rule_shop)

    alias_rows = session.exec(
        select(Shop, ShopAddress)
        .join(ShopAddress, col(ShopAddress.shop_id) == col(Shop.id))
        .where(
            col(Shop.owner_id) == owner_id,
            col(ShopAddress.address_normalized) == normalized_address,
        )
        .order_by(col(Shop.is_active).desc(), col(Shop.id).asc())
    ).all()
    for alias_shop, _ in alias_rows:
        if normalize_shop_name(alias_shop.retail_name or "") != normalized_name:
            continue
        _activate_shop(alias_shop, shop_owner_id=shop_in.shop_owner_id)
        session.add(alias_shop)
        touch_shop_address(
            session=session,
            shop=alias_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return ShopMatchResult(shop=alias_shop)

    same_name_shop = None
    rows = session.exec(
        select(Shop)
        .where(col(Shop.owner_id) == owner_id)
        .order_by(col(Shop.is_active).desc(), col(Shop.id).asc())
    ).all()
    for row in rows:
        if normalize_shop_name(row.retail_name or "") == normalized_name:
            same_name_shop = row
            break

    if same_name_shop is not None:
        _activate_shop(same_name_shop, shop_owner_id=shop_in.shop_owner_id)
        session.add(same_name_shop)
        conflict_alias = touch_shop_address(
            session=session,
            shop=same_name_shop,
            address_raw=address,
            make_primary=False,
        )
        session.flush()
        return ShopMatchResult(
            shop=same_name_shop,
            conflict_alias_id=conflict_alias.id,
        )

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
    return ShopMatchResult(shop=created)


def get_or_create_shop(
    session: Session, *, owner_id: uuid.UUID, shop_in: ShopCreate
) -> Shop | None:
    return match_or_create_shop(
        session=session,
        owner_id=owner_id,
        shop_in=shop_in,
    ).shop


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
