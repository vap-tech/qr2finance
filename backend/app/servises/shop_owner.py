from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import Session, select

from app.models import ShopOwner, ShopOwnerCreate


def get_or_create_shop_owner(session: Session, shop_owner_in: ShopOwnerCreate):
    """Get an existing shop owner by INN/name or create a new one without committing."""
    if (
        shop_owner_in.name is None
        or shop_owner_in.inn is None
        or shop_owner_in.name.strip() == ""
        or shop_owner_in.inn.strip() == ""
    ):
        return None

    statement = select(ShopOwner).where(
        ShopOwner.inn == shop_owner_in.inn,
        ShopOwner.name == shop_owner_in.name,
    )

    try:
        shop_owner = session.exec(statement).one_or_none()
    except MultipleResultsFound as exc:
        raise MultipleResultsFound(
            "Duplicate shop owner found for "
            f"inn={shop_owner_in.inn!r}, name={shop_owner_in.name!r}"
        ) from exc

    if not shop_owner:
        shop_owner = ShopOwner(**shop_owner_in.model_dump())
        session.add(shop_owner)
    elif shop_owner.is_active is False:
        shop_owner.is_active = True
        session.add(shop_owner)

    session.flush()
    return shop_owner
