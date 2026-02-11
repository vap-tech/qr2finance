import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ShopCategory,
    ShopCategoryCreate,
    ShopCategoryPublic,
    ShopCategorysPublic,
    ShopCategoryUpdate,
)
from app.servises.shop_category import get_or_create_shop_category

router = APIRouter(prefix="/shop-categories", tags=["shop-categories"])


def _category_base_query(current_user: CurrentUser):
    """
    Superuser -> все категории
    User -> только свои
    """
    if current_user.is_superuser:
        return select(ShopCategory)
    return select(ShopCategory).where(ShopCategory.owner_id == current_user.id)


@router.get("/", response_model=ShopCategorysPublic)
def read_shop_categories(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
) -> Any:
    """
    Retrieve shop categories (paginated).
    """
    base_query = _category_base_query(current_user)

    if q := (q.strip() if q else None):
        base_query = base_query.where(col(ShopCategory.name).ilike(f"%{q}%"))

    # count
    count_stmt = select(func.count()).select_from(base_query.subquery())
    count = session.exec(count_stmt).one()

    # data
    stmt = base_query.order_by(ShopCategory.name).offset(skip).limit(limit)
    categories = session.exec(stmt).all()

    return ShopCategorysPublic(
        data=[ShopCategoryPublic.model_validate(c) for c in categories],
        count=count,
    )


@router.get("/{category_id}", response_model=ShopCategoryPublic)
def read_shop_categorie(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
) -> Any:
    base_query = _category_base_query(current_user).where(
        ShopCategory.id == category_id
    )
    cat = session.exec(base_query).one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    return cat


@router.post("/", response_model=ShopCategoryPublic)
def create_category(
    session: SessionDep, current_user: CurrentUser, cat_in: ShopCategoryCreate
) -> Any:
    cat = get_or_create_shop_category(
        session=session,
        owner_id=current_user.id,
        is_superuser=current_user.is_superuser,
        cat_in=cat_in,
    )
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=ShopCategoryPublic)
def update_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
    cat_in: ShopCategoryUpdate,
) -> Any:
    base_query = _category_base_query(current_user).where(
        ShopCategory.id == category_id
    )
    cat = session.exec(base_query).one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    data = cat_in.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()

    cat.sqlmodel_update(data)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/{category_id}", response_model=ShopCategoryPublic)
def delete_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
):
    """
    Soft-delete shop category (is_active = False).
    Superuser -> любую
    User -> только свою
    """
    base_query = _category_base_query(current_user).where(
        ShopCategory.id == category_id
    )

    cat = session.exec(base_query).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if not cat.is_active:
        # идемпотентность: повторный delete не ошибка
        return cat

    cat.is_active = False
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat
