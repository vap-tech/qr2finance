import uuid
from datetime import datetime

from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import Session, col, select

from app.models import (
    ShopOwner,
    ShopOwnerCreate,
    ShopOwnerName,
    ShopOwnerNamePublic,
    ShopOwnerPublic,
    get_datetime_utc,
)


def _clean_name(name: str | None) -> str:
    if name is None:
        return ""
    return " ".join(name.strip().split())


def _clean_inn(inn: str | None) -> str:
    if inn is None:
        return ""
    return inn.strip()


def normalize_shop_owner_name(name: str) -> str:
    """
    Normalize for de-duplication while preserving visibly different forms
    (quotes/full legal form) as separate aliases for user review.
    """
    return " ".join(name.strip().split()).casefold()


def list_shop_owner_aliases(
    session: Session, *, shop_owner_id: uuid.UUID
) -> list[ShopOwnerName]:
    statement = (
        select(ShopOwnerName)
        .where(col(ShopOwnerName.shop_owner_id) == shop_owner_id)
        .order_by(
            col(ShopOwnerName.is_primary).desc(),
            col(ShopOwnerName.seen_count).desc(),
            col(ShopOwnerName.last_seen_at).desc(),
        )
    )
    return list(session.exec(statement))


def build_shop_owner_public(session: Session, shop_owner: ShopOwner) -> ShopOwnerPublic:
    aliases = list_shop_owner_aliases(session=session, shop_owner_id=shop_owner.id)
    alias_public = [ShopOwnerNamePublic.model_validate(i) for i in aliases]
    aliases_count = len(alias_public)
    return ShopOwnerPublic(
        id=shop_owner.id,
        name=shop_owner.name,
        inn=shop_owner.inn,
        aliases_count=aliases_count,
        has_name_conflict=aliases_count > 1,
        aliases=alias_public,
    )


def touch_shop_owner_alias(
    session: Session,
    *,
    shop_owner: ShopOwner,
    name_raw: str,
    make_primary: bool = False,
    now: datetime | None = None,
) -> ShopOwnerName:
    cleaned_name = _clean_name(name_raw)
    if cleaned_name == "":
        raise ValueError("Shop owner name cannot be empty")
    normalized_name = normalize_shop_owner_name(cleaned_name)
    timestamp = now or get_datetime_utc()

    alias = session.exec(
        select(ShopOwnerName).where(
            col(ShopOwnerName.shop_owner_id) == shop_owner.id,
            col(ShopOwnerName.name_normalized) == normalized_name,
        )
    ).one_or_none()

    if alias is None:
        alias = ShopOwnerName(
            shop_owner_id=shop_owner.id,
            name_raw=cleaned_name,
            name_normalized=normalized_name,
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
        # Keep the most recent visible variant for this normalized alias.
        alias.name_raw = cleaned_name
        session.add(alias)

    if make_primary:
        all_aliases = list_shop_owner_aliases(
            session=session, shop_owner_id=shop_owner.id
        )
        for item in all_aliases:
            item.is_primary = item.id == alias.id
            session.add(item)
        shop_owner.name = alias.name_raw
        session.add(shop_owner)
    else:
        has_primary = session.exec(
            select(ShopOwnerName.id).where(
                col(ShopOwnerName.shop_owner_id) == shop_owner.id,
                col(ShopOwnerName.is_primary).is_(True),
            )
        ).first()
        if has_primary is None:
            alias.is_primary = True
            shop_owner.name = alias.name_raw
            session.add(alias)
            session.add(shop_owner)

    session.flush()
    return alias


def set_shop_owner_primary_alias(
    session: Session, *, shop_owner: ShopOwner, alias_id: uuid.UUID
) -> ShopOwnerName:
    aliases = list_shop_owner_aliases(session=session, shop_owner_id=shop_owner.id)
    selected = next((i for i in aliases if i.id == alias_id), None)
    if selected is None:
        raise ValueError("Alias not found for this shop owner")

    for item in aliases:
        item.is_primary = item.id == alias_id
        session.add(item)

    shop_owner.name = selected.name_raw
    session.add(shop_owner)
    session.flush()
    return selected


def get_or_create_shop_owner(session: Session, shop_owner_in: ShopOwnerCreate):
    """Get an existing shop owner by INN or create one, and track observed names."""
    name = _clean_name(shop_owner_in.name)
    inn = _clean_inn(shop_owner_in.inn)
    if name == "" or inn == "":
        return None

    statement = select(ShopOwner).where(ShopOwner.inn == inn)
    try:
        shop_owner = session.exec(statement).one_or_none()
    except MultipleResultsFound as exc:
        raise MultipleResultsFound(
            f"Duplicate shop owner found for inn={inn!r}"
        ) from exc

    if shop_owner is None:
        shop_owner = ShopOwner(name=name, inn=inn)
        session.add(shop_owner)
        session.flush()
        touch_shop_owner_alias(
            session=session,
            shop_owner=shop_owner,
            name_raw=name,
            make_primary=True,
        )
    else:
        if shop_owner.is_active is False:
            shop_owner.is_active = True
            session.add(shop_owner)
        touch_shop_owner_alias(
            session=session,
            shop_owner=shop_owner,
            name_raw=name,
            make_primary=False,
        )

    session.flush()
    return shop_owner
