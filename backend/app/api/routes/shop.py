import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Message,
    SetShopCategories,
    Shop,
    ShopCategoryLink,
    ShopCreate,
    ShopDuplicateScanResult,
    ShopOwnerPublic,
    ShopPublic,
    ShopRead,
    ShopsPublic,
    ShopUpdate,
)
from app.servises.shop import (
    get_or_create_shop,
    get_shop_read,
    rescan_shop_address_duplicates,
    rescan_shop_name_duplicates,
    set_shop_categories,
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
    base = _shop_query_for_user(current_user)

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

    shop_ids = [shop.id for shop in shops]
    category_map: dict[uuid.UUID, list[uuid.UUID]] = {sid: [] for sid in shop_ids}
    if shop_ids:
        link_stmt = select(
            ShopCategoryLink.shop_id, ShopCategoryLink.category_id
        ).where(col(ShopCategoryLink.shop_id).in_(shop_ids))
        if not current_user.is_superuser:
            link_stmt = link_stmt.where(
                col(ShopCategoryLink.owner_id) == current_user.id
            )
        links = session.exec(link_stmt).all()
        for shop_id, category_id in links:
            category_map.setdefault(shop_id, []).append(category_id)

    data: list[ShopRead] = []
    for shop in shops:
        shop_owner = (
            ShopOwnerPublic.model_validate(shop.shop_owner) if shop.shop_owner else None
        )
        data.append(
            ShopRead(
                id=shop.id,
                retail_name=shop.retail_name,
                address=shop.address,
                is_favorite=shop.is_favorite,
                notes=shop.notes,
                is_active=shop.is_active,
                shop_owner_id=shop.shop_owner_id,
                shop_owner=shop_owner,
                category_ids=category_map.get(shop.id, []),
                has_name_duplicate=shop.has_name_duplicate,
                has_address_duplicate=shop.has_address_duplicate,
            )
        )

    return ShopsPublic(
        data=data,
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
    if shop_in.notes is not None:
        shop_in.notes = shop_in.notes.strip()
    shop = get_or_create_shop(
        session=session, owner_id=current_user.id, shop_in=shop_in
    )
    if shop is None:
        raise HTTPException(
            status_code=400, detail="retail_name and address are required"
        )

    session.commit()
    session.refresh(shop)
    return get_shop_read(session=session, owner_id=shop.owner_id, shop_id=shop.id)


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
    if "retail_name" in update_dict and update_dict["retail_name"] is not None:
        update_dict["retail_name"] = update_dict["retail_name"].strip()
    if "address" in update_dict and update_dict["address"] is not None:
        update_dict["address"] = update_dict["address"].strip()
    if "notes" in update_dict and update_dict["notes"] is not None:
        update_dict["notes"] = update_dict["notes"].strip()

    # защита: нельзя перевесить owner_id даже если подсунуть
    update_dict.pop("owner_id", None)

    shop.sqlmodel_update(update_dict)
    session.add(shop)
    session.commit()
    session.refresh(shop)
    return get_shop_read(session=session, owner_id=shop.owner_id, shop_id=shop.id)


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


@router.post("/duplicates/scan-names", response_model=ShopDuplicateScanResult)
def scan_name_duplicates(
    session: SessionDep,
    current_user: CurrentUser,
) -> ShopDuplicateScanResult:
    scanned, marked = rescan_shop_name_duplicates(
        session=session,
        owner_id=current_user.id,
    )
    session.commit()
    return ShopDuplicateScanResult(scanned=scanned, marked=marked, field="name")


@router.post("/duplicates/scan-addresses", response_model=ShopDuplicateScanResult)
def scan_address_duplicates(
    session: SessionDep,
    current_user: CurrentUser,
) -> ShopDuplicateScanResult:
    scanned, marked = rescan_shop_address_duplicates(
        session=session,
        owner_id=current_user.id,
    )
    session.commit()
    return ShopDuplicateScanResult(scanned=scanned, marked=marked, field="address")


@router.put("/{id}/categories", response_model=ShopPublic)
def replace_shop_categories(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    body: SetShopCategories,
) -> Any:
    """
    Replace shop categories (idempotent).
    """
    # 1) Получаем магазин с учётом прав
    shop = _get_shop_or_404(session, current_user, id)

    try:
        # owner_id берём у магазина
        # (суперюзер может менять чужие)
        set_shop_categories(
            session=session,
            owner_id=shop.owner_id,
            shop_id=shop.id,
            category_ids=body.category_ids,
        )
    except ValueError as e:
        # проброс из сервайсез логики
        raise HTTPException(status_code=422, detail=str(e))

    return get_shop_read(session=session, owner_id=shop.owner_id, shop_id=shop.id)
