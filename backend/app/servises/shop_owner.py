from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import Session, select

from app.models import ShopOwner, ShopOwnerCreate


def get_or_create_shop_owner(session: Session, shop_owner_in: ShopOwnerCreate):
    """Get an existing shop owner by INN/name or create a new one without committing."""
    if shop_owner_in.name is None or shop_owner_in.inn is None:
        return None

    name = shop_owner_in.name.strip()
    inn = shop_owner_in.inn.strip()
    if name == "" or inn == "":
        return None

    statement = select(ShopOwner).where(
        ShopOwner.inn == inn,
        ShopOwner.name == name,
    )

    try:
        shop_owner = session.exec(statement).one_or_none()
    except MultipleResultsFound as exc:
        raise MultipleResultsFound(
            f"Duplicate shop owner found for inn={inn!r}, name={name!r}"
        ) from exc

    if not shop_owner:
        shop_owner = ShopOwner(name=name, inn=inn)
        session.add(shop_owner)
    elif shop_owner.is_active is False:
        shop_owner.is_active = True
        session.add(shop_owner)

    session.flush()
    return shop_owner
