from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas, services
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/stores", tags=["stores"])


# GET /stores?skip=0&limit=100
@router.get("/", response_model=List[schemas.Shop])
def read_stores(
    sort_by: str = "total_amount",
    descending: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return services.get_spending_by_retail_shops(
        db, user_id=current_user.id, sort_by=sort_by, descending=descending
    )


# GET /stores/stats
@router.get("/stats", response_model=List[schemas.StoreStat])
def get_stores_stats(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    # Используем метод, который мы уже писали в services
    return services.get_spending_by_retail_shops(db, user_id=current_user.id)


# POST /stores/
@router.post("/", response_model=schemas.Shop)
def create_manual_store(
    store_data: dict,  # Фронт шлет кастомный JSON
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Логика сохранения магазина, созданного вручную на фронте
    new_shop = models.Shop(
        retail_name=store_data.get("name"),
        legal_name=store_data.get("chain_name", "Unknown"),
        address=store_data.get("address"),
        category=store_data.get("category"),
        is_favorite=store_data.get("is_favorite", False),
        notes=store_data.get("notes"),
        inn="0000000000",  # Заглушка, если ИНН не пришел с фронта
    )
    db.add(new_shop)
    db.commit()
    db.refresh(new_shop)
    return new_shop


@router.put("/{store_id}", response_model=schemas.Shop)
def update_store(
    store_id: int,
    store_data: dict,  # Принимаем данные от фронта
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # 1. Ищем магазин в базе
    query = select(models.Shop).where(models.Shop.id == store_id)
    db_shop = db.execute(query).scalar_one_or_none()

    if not db_shop:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    # 2. Обновляем поля, сопоставляя имена фронтенда с именами бэкенда
    if "category" in store_data:
        db_shop.category = store_data["category"]
    if "is_favorite" in store_data:
        db_shop.is_favorite = store_data["is_favorite"]
    if "notes" in store_data:
        db_shop.notes = store_data["notes"]

    # 3. Сохраняем изменения
    db.commit()
    db.refresh(db_shop)

    return db_shop


@router.delete("/{store_id}")
def delete_store(
    store_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = select(models.Shop).where(models.Shop.id == store_id)
    db_shop = db.execute(query).scalar_one_or_none()

    if not db_shop:
        raise HTTPException(status_code=404, detail="Магазин не найден")

    db.delete(db_shop)
    db.commit()
    return {"status": "success", "message": "Магазин удален"}
