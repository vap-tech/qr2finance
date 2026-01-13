from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
from .. import crud, schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/monthly-stats", response_model=List[schemas.MonthlyStats])
def get_monthly_stats(
    start_date: Optional[datetime] = Query(None, description="Start date for filtering"),
    end_date: Optional[datetime] = Query(None, description="End date for filtering"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_monthly_stats(
        db,
        user_id=current_user.user_id,
        start_date=start_date,
        end_date=end_date
    )

@router.get("/top-products", response_model=List[schemas.TopProducts])
def get_top_products(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_top_products(db, user_id=current_user.user_id, limit=limit)

@router.get("/store-stats", response_model=List[schemas.StoreStats])
def get_store_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_store_stats(db, user_id=current_user.user_id)