import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    ShopOwner,
    ShopOwnerCreate,
    ShopOwnerName,
    ShopOwnerPrimaryAliasUpdate,
    ShopOwnerPublic,
    ShopOwnersPublic,
    ShopOwnerUpdate,
)
from app.servises.shop_owner import (
    build_shop_owner_public,
    get_or_create_shop_owner,
    set_shop_owner_primary_alias,
    touch_shop_owner_alias,
)

router = APIRouter(prefix="/shop-owners", tags=["shop-owners"])


@router.get("/", response_model=ShopOwnersPublic)
def read_shop_owners(
    session: SessionDep, _: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve shop owners.
    """

    count_statement = (
        select(func.count())
        .select_from(ShopOwner)
        .where(col(ShopOwner.is_active).is_(True))
    )
    count = session.exec(count_statement).one()
    statement = (
        select(ShopOwner, func.count(col(ShopOwnerName.id)))
        .join(
            ShopOwnerName,
            col(ShopOwnerName.shop_owner_id) == col(ShopOwner.id),
            isouter=True,
        )
        .where(col(ShopOwner.is_active).is_(True))
        .group_by(col(ShopOwner.id))
        .order_by(col(ShopOwner.name).asc())
        .offset(skip)
        .limit(limit)
    )
    rows = session.exec(statement).all()
    data = []
    for shop_owner, aliases_count in rows:
        count_value = int(aliases_count)
        data.append(
            ShopOwnerPublic(
                id=shop_owner.id,
                name=shop_owner.name,
                inn=shop_owner.inn,
                aliases_count=count_value,
                has_name_conflict=count_value > 1,
            )
        )

    return ShopOwnersPublic(data=data, count=count)


@router.get("/{id}", response_model=ShopOwnerPublic)
def read_shop_owner(session: SessionDep, _: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get shop owner by ID.
    """
    shop_owner = session.get(ShopOwner, id)
    if not shop_owner:
        raise HTTPException(status_code=404, detail="Shop owner not found")
    return build_shop_owner_public(session, shop_owner)


@router.post("/", response_model=ShopOwnerPublic)
def create_shop_owner(
    *, session: SessionDep, _: CurrentUser, shop_owner_in: ShopOwnerCreate
) -> Any:
    """
    Create new shop owner.
    """
    try:
        shop_owner = get_or_create_shop_owner(
            session=session, shop_owner_in=shop_owner_in
        )
        if shop_owner is None:
            raise HTTPException(status_code=422, detail="name and inn are required")
        session.commit()
        session.refresh(shop_owner)
        return build_shop_owner_public(session, shop_owner)
    except MultipleResultsFound as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    finally:
        if session.in_transaction():
            session.rollback()


@router.put("/{id}", response_model=ShopOwnerPublic)
def update_shop_owner(
    *,
    session: SessionDep,
    _: CurrentUser,
    id: uuid.UUID,
    shop_owner_in: ShopOwnerUpdate,
) -> Any:
    """
    Update a shop owner.
    """
    shop_owner = session.get(ShopOwner, id)
    if not shop_owner:
        raise HTTPException(status_code=404, detail="Shop owner not found")
    update_dict = shop_owner_in.model_dump(exclude_unset=True)
    if "name" in update_dict and update_dict["name"] is not None:
        update_dict["name"] = update_dict["name"].strip()
    if "inn" in update_dict and update_dict["inn"] is not None:
        update_dict["inn"] = update_dict["inn"].strip()
    if update_dict.get("name") == "" or update_dict.get("inn") == "":
        raise HTTPException(status_code=422, detail="name and inn cannot be empty")
    shop_owner.sqlmodel_update(update_dict)
    if "name" in update_dict and update_dict["name"] is not None:
        touch_shop_owner_alias(
            session=session,
            shop_owner=shop_owner,
            name_raw=update_dict["name"],
            make_primary=True,
        )
    session.add(shop_owner)
    session.commit()
    session.refresh(shop_owner)
    return build_shop_owner_public(session, shop_owner)


@router.patch("/{id}/primary-name", response_model=ShopOwnerPublic)
def set_primary_name(
    *,
    session: SessionDep,
    _: CurrentUser,
    id: uuid.UUID,
    payload: ShopOwnerPrimaryAliasUpdate,
) -> Any:
    """
    Set primary visible name for shop owner.
    """
    shop_owner = session.get(ShopOwner, id)
    if not shop_owner:
        raise HTTPException(status_code=404, detail="Shop owner not found")
    try:
        set_shop_owner_primary_alias(
            session=session,
            shop_owner=shop_owner,
            alias_id=payload.alias_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    session.commit()
    session.refresh(shop_owner)
    return build_shop_owner_public(session, shop_owner)


@router.delete("/{id}")
def delete_shop_owner(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete a shop owner.
    """
    shop_owner = session.get(ShopOwner, id)
    if not shop_owner:
        raise HTTPException(status_code=404, detail="Shop owner not found")
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    shop_owner.is_active = False
    session.add(shop_owner)
    session.commit()
    return Message(message="Shop owner deactivated successfully")
