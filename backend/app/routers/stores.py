from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import crud, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/stores", tags=["stores"])


@router.post("/", response_model=schemas.Store)
def create_store(
        store: schemas.StoreCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    return crud.create_store(db=db, store=store, user_id=current_user.user_id)


@router.get("/", response_model=List[schemas.Store])
def read_stores(
        skip: int = 0,
        limit: int = 100,
        favorite_only: bool = Query(False, description="Только избранные магазины"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    stores = crud.get_user_stores(db, user_id=current_user.user_id, skip=skip, limit=limit)

    if favorite_only:
        stores = [store for store in stores if store.is_favorite]

    return stores


@router.get("/stats", response_model=List[schemas.Store])
def get_stores_stats(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    stats = crud.get_store_stats2(db, user_id=current_user.user_id)
    return stats


@router.get("/{store_id}", response_model=schemas.Store)
def read_store(
        store_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    store = crud.get_store_by_id(db, store_id=store_id, user_id=current_user.user_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    return store


@router.put("/{store_id}", response_model=schemas.Store)
def update_store(
        store_id: int,
        store_update: schemas.StoreUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    store = crud.update_store(db, store_id=store_id, store_update=store_update, user_id=current_user.user_id)
    if store is None:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    return store


@router.delete("/{store_id}")
def delete_store(
        store_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    success = crud.delete_store(db, store_id=store_id, user_id=current_user.user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Магазин не найден")
    return {"message": "Магазин удален"}


@router.post("/auto-detect")
def auto_detect_store(
        retail_place: str = Query(..., description="Название магазина из чека"),
        address: Optional[str] = Query(None, description="Адрес магазина из чека"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    store_id = crud.find_store_for_receipt(
        db,
        user_id=current_user.user_id,
        retail_place=retail_place,
        retail_place_address=address
    )

    return {"store_id": store_id, "retail_place": retail_place}