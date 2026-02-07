from sqlmodel import Session, select

from app.models import Shop, ShopCreate


def get_or_create_shop(session: Session, shop_in: ShopCreate):
    """Get an existing shop by INN/name or create a new one without committing."""
    if not shop_in.inn:
        return None

    statement = select(Shop)
    if shop_in.inn:
        statement = statement.where(Shop.inn == shop_in.inn)
    elif shop_in.legal_name:
        statement = statement.where(Shop.legal_name == shop_in.legal_name)
    else:
        statement = statement.where(Shop.retail_name == shop_in.retail_name)

    shop = session.exec(statement).first()

    if not shop:
        shop = Shop(**shop_in.model_dump())
        session.add(shop)
        session.flush()
    return shop
