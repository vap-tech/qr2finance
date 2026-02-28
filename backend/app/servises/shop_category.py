import uuid

from sqlmodel import Session, col, select

from app.models import ShopCategory, ShopCategoryCreate


def _clean(s: str) -> str:
    return s.strip()


def get_or_create_shop_category(
    session: Session,
    *,
    owner_id: uuid.UUID,
    is_superuser: bool,
    cat_in: ShopCategoryCreate,
) -> ShopCategory:
    """
    Return an existing category by name (with revive for inactive) or create a new one.

    Regular user:
    - can reuse/revive only own category by name.

    Superuser:
    - can reuse/revive any category by name (owner check is bypassed).
    """
    name = _clean(cat_in.name)

    base_stmt = select(ShopCategory).where(ShopCategory.name == name)
    if not is_superuser:
        base_stmt = base_stmt.where(ShopCategory.owner_id == owner_id)

    existing = session.exec(
        base_stmt.order_by(col(ShopCategory.is_active).desc(), col(ShopCategory.id))
    ).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            session.add(existing)
            session.flush()
        return existing

    cat = ShopCategory(owner_id=owner_id, name=name, is_active=True)
    session.add(cat)
    session.flush()
    return cat
