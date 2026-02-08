import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Message, Shop, ShopCreate, ShopPublic, ShopsPublic, ShopUpdate
from app.servises.shop import (
    get_or_create_shop,
    get_shop_read,
)

router = APIRouter(prefix="/shops", tags=["shops"])


def _shop_query_for_user(current_user: CurrentUser):
    """
    Superuser видит всё.
    Обычный пользователь — только своё (owner_id == current_user.id).
    """
    if current_user.is_superuser:
        return select(Shop)
    return select(Shop).where(Shop.owner_id == current_user.id)


def _get_shop_or_404(
    session: SessionDep, current_user: CurrentUser, shop_id: uuid.UUID
) -> Shop:
    """
    Superuser может достать любой shop по id.
    Обычный пользователь — только свой.
    """
    if current_user.is_superuser:
        shop = session.get(Shop, shop_id)
    else:
        shop = session.exec(
            select(Shop).where(Shop.id == shop_id, Shop.owner_id == current_user.id)
        ).first()

    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/", response_model=ShopsPublic)
def read_shops(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve shops (superuser: all, user: own).
    """
    base = _shop_query_for_user(current_user).where(Shop.is_active.is_(True))  # type: ignore[attr-defined]

    count_statement = select(func.count()).select_from(base.subquery())
    count = session.exec(count_statement).one()

    statement = (
        base.order_by(
            Shop.id.desc()  # type: ignore[attr-defined]
        )  # если по created_at/purchased_at — поменять тут
        .offset(skip)
        .limit(limit)
    )
    shops = session.exec(statement).all()

    return ShopsPublic(
        data=[ShopPublic.model_validate(i) for i in shops],
        count=count,
    )


@router.get("/{id}", response_model=ShopPublic)
def read_shop(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    """
    Get shop by ID (superuser: any, user: own).
    """
    shop = _get_shop_or_404(session, current_user, id)
    return get_shop_read(session=session, owner_id=shop.owner_id, shop_id=shop.id)


@router.post("/", response_model=ShopPublic)
def create_shop(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    shop_in: ShopCreate,
) -> Any:
    """
    Create new shop (always owned by current_user, even for superuser unless).
    """
    shop = get_or_create_shop(
        session=session, owner_id=current_user.id, shop_in=shop_in
    )
    if shop is None:
        raise HTTPException(
            status_code=400, detail="retail_name and address are required"
        )

    session.commit()
    session.refresh(shop)
    return shop


@router.put("/{id}", response_model=ShopPublic)
def update_shop(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    shop_in: ShopUpdate,
) -> Any:
    """
    Update a shop (superuser: any, user: own).
    """
    shop = _get_shop_or_404(session, current_user, id)

    update_dict = shop_in.model_dump(exclude_unset=True)

    # защита: обычный юзер не может перевесить owner_id даже если подсунет
    update_dict.pop("owner_id", None)

    shop.sqlmodel_update(update_dict)
    session.add(shop)
    session.commit()
    session.refresh(shop)
    return shop


@router.delete("/{id}", response_model=Message)
def delete_shop(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Message:
    """
    Delete a shop.

    soft-delete (is_active=false), чтобы не ломать чеки.
    Superuser может удалить любой, обычный юзер — только свой.
    """
    shop = _get_shop_or_404(session, current_user, id)

    # SOFT delete вместо физического удаления
    shop.is_active = False
    session.add(shop)
    session.commit()

    return Message(message="Shop deleted successfully")
