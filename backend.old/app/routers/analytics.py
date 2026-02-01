from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import schemas, services
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/total-sums", response_model=schemas.TotalSums)
def get_total_sum(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return services.get_user_total_sum(db, user_id=current_user.id)


@router.get("/monthly-dynamics", response_model=List[schemas.MonthlyDynamics])
def get_monthly_dynamics(
    year: int = Query(2026, description="Год для анализа"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = services.get_monthly_dynamics(db, user_id=current_user.id, year=year)

    return [
        {
            "month": r.month,
            "receipts_count": r.receipts_count,
            "total_sum": r.total_sum,
            "cash_total_sum": r.cash_total_sum,
            "ecash_total_sum": r.ecash_total_sum,
        }
        for r in results
    ]


@router.get("/top-products", response_model=List[schemas.ProductTop])
def get_top_products(
    months: int = Query(3, ge=1, le=26),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    results = services.get_top_products_by_period(
        db, user_id=current_user.id, months_back=months, limit=limit
    )
    return [
        {
            "name": r.name,
            "total_sum": r.total_sum,
            "total_quantity": r.total_quantity,
            "measure": r.measure,
        }
        for r in results
    ]


@router.get("/store-stats", response_model=List[schemas.StoreStat])
def get_store_stats(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    results = services.get_spending_by_retail_shops(db, user_id=current_user.id)
    return [
        {
            "id": r.id,
            "retail_name": r.retail_name,
            "legal_name": r.legal_name,
            "total_amount": r.total_amount,
            "receipts_count": r.receipts_count,
            "receipt_avg": r.receipt_avg,
        }
        for r in results
    ]
