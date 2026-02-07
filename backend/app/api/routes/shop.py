import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    Shop,
    ShopCreate,
    ShopPublic,
    ShopsPublic,
    ShopUpdate,
)
from app.servises.shop import get_or_create_shop

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("/", response_model=ShopsPublic)
def read_shops(
    session: SessionDep, _: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve shops.
    """

    count_statement = select(func.count()).select_from(Shop)
    count = session.exec(count_statement).one()
    statement = (
        select(Shop)
        .order_by(Shop.id.desc())  # type: ignore
        .offset(skip)
        .limit(limit)
    )
    shops = session.exec(statement).all()

    return ShopsPublic(data=[ShopPublic.model_validate(i) for i in shops], count=count)


@router.get("/{id}", response_model=ShopPublic)
def read_shop(session: SessionDep, _: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get shop by ID.
    """
    shop = session.get(Shop, id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.post("/", response_model=ShopPublic)
def create_shop(*, session: SessionDep, _: CurrentUser, shop_in: ShopCreate) -> Any:
    """
    Create new shop.
    """
    shop = get_or_create_shop(session=session, shop_in=shop_in)
    session.commit()
    session.refresh(shop)
    return shop


@router.put("/{id}", response_model=ShopPublic)
def update_shop(
    *,
    session: SessionDep,
    _: CurrentUser,
    id: uuid.UUID,
    shop_in: ShopUpdate,
) -> Any:
    """
    Update an shop.
    """
    shop = session.get(Shop, id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    update_dict = shop_in.model_dump(exclude_unset=True)
    shop.sqlmodel_update(update_dict)
    session.add(shop)
    session.commit()
    session.refresh(shop)
    return shop


@router.delete("/{id}")
def delete_shop(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an shop.
    """
    shop = session.get(Shop, id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(shop)
    session.commit()
    return Message(message="Shop deleted successfully")
