import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ReceiptItemCategory,
    ReceiptItemCategoryCreate,
    ReceiptItemCategoryPublic,
    ReceiptItemCategorysPublic,
    ReceiptItemCategoryUpdate,
)
from app.servises.receipt_item_category import get_or_create_receipt_item_category

router = APIRouter(
    prefix="/receipt-item-categories",
    tags=["receipt-item-categories"],
)


def _category_base_query(current_user: CurrentUser):
    if current_user.is_superuser:
        return select(ReceiptItemCategory)
    return select(ReceiptItemCategory).where(
        ReceiptItemCategory.owner_id == current_user.id
    )


@router.get("/", response_model=ReceiptItemCategorysPublic)
def read_receipt_item_categories(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    q: str | None = None,
) -> Any:
    base_query = _category_base_query(current_user)

    if q := (q.strip() if q else None):
        base_query = base_query.where(col(ReceiptItemCategory.name).ilike(f"%{q}%"))

    base_query = base_query.where(col(ReceiptItemCategory.is_active).is_(True))

    count_stmt = select(func.count()).select_from(base_query.subquery())
    count = session.exec(count_stmt).one()

    stmt = base_query.order_by(ReceiptItemCategory.name).offset(skip).limit(limit)
    categories = session.exec(stmt).all()

    return ReceiptItemCategorysPublic(
        data=[ReceiptItemCategoryPublic.model_validate(c) for c in categories],
        count=count,
    )


@router.get("/{category_id}", response_model=ReceiptItemCategoryPublic)
def read_receipt_item_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
) -> Any:
    base_query = _category_base_query(current_user).where(
        ReceiptItemCategory.id == category_id
    )
    cat = session.exec(base_query).one_or_none()

    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    return cat


@router.post("/", response_model=ReceiptItemCategoryPublic)
def create_receipt_item_category(
    session: SessionDep,
    current_user: CurrentUser,
    cat_in: ReceiptItemCategoryCreate,
) -> Any:
    cat = get_or_create_receipt_item_category(
        session=session,
        owner_id=current_user.id,
        is_superuser=current_user.is_superuser,
        cat_in=cat_in,
    )
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=ReceiptItemCategoryPublic)
def update_receipt_item_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
    cat_in: ReceiptItemCategoryUpdate,
) -> Any:
    base_query = _category_base_query(current_user).where(
        ReceiptItemCategory.id == category_id
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


@router.delete("/{category_id}", response_model=ReceiptItemCategoryPublic)
def delete_receipt_item_category(
    session: SessionDep,
    current_user: CurrentUser,
    category_id: uuid.UUID,
) -> Any:
    base_query = _category_base_query(current_user).where(
        ReceiptItemCategory.id == category_id
    )

    cat = session.exec(base_query).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if not cat.is_active:
        return cat

    cat.is_active = False
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat
