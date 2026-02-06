import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Cashier,
    CashierCreate,
    CashierPublic,
    CashiersPublic,
    CashierUpdate,
    Message,
)
from app.servises.cashier import get_or_create_cashier

router = APIRouter(prefix="/cashiers", tags=["cashiers"])


@router.get("/", response_model=CashiersPublic)
def read_cashiers(
    session: SessionDep, _: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve cashiers.
    """

    count_statement = select(func.count()).select_from(Cashier)
    count = session.exec(count_statement).one()
    statement = (
        select(Cashier)
        .order_by(Cashier.id.desc())  # type: ignore
        .offset(skip)
        .limit(limit)
    )
    cashiers = session.exec(statement).all()

    return CashiersPublic(
        data=[CashierPublic.model_validate(i) for i in cashiers], count=count
    )


@router.get("/{id}", response_model=CashierPublic)
def read_cashier(session: SessionDep, _: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get cashier by ID.
    """
    cashier = session.get(Cashier, id)
    if not cashier:
        raise HTTPException(status_code=404, detail="Cashier not found")
    return cashier


@router.post("/", response_model=CashierPublic)
def create_cashier(
    *, session: SessionDep, _: CurrentUser, cashier_in: CashierCreate
) -> Any:
    """
    Create new cashier.
    """
    cashier = get_or_create_cashier(session=session, cashier_in=cashier_in)
    session.commit()
    session.refresh(cashier)
    return cashier


@router.put("/{id}", response_model=CashierPublic)
def update_cashier(
    *,
    session: SessionDep,
    _: CurrentUser,
    id: uuid.UUID,
    cashier_in: CashierUpdate,
) -> Any:
    """
    Update an cashier.
    """
    cashier = session.get(Cashier, id)
    if not cashier:
        raise HTTPException(status_code=404, detail="Cashier not found")
    update_dict = cashier_in.model_dump(exclude_unset=True)
    cashier.sqlmodel_update(update_dict)
    session.add(cashier)
    session.commit()
    session.refresh(cashier)
    return cashier


@router.delete("/{id}")
def delete_cashier(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete an cashier.
    """
    cashier = session.get(Cashier, id)
    if not cashier:
        raise HTTPException(status_code=404, detail="Cashier not found")
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(cashier)
    session.commit()
    return Message(message="Cashier deleted successfully")
