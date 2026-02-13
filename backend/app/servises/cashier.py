from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import Session, select

from app.models import Cashier, CashierCreate


def get_or_create_cashier(session: Session, cashier_in: CashierCreate):
    """Get an existing cashier by INN/name or create a new one without committing."""
    if (
        cashier_in.name is None
        or cashier_in.inn is None
        or cashier_in.name.strip() == ""
        or cashier_in.inn.strip() == ""
    ):
        return None

    statement = select(Cashier).where(
        Cashier.inn == cashier_in.inn,
        Cashier.name == cashier_in.name,
    )

    try:
        cashier = session.exec(statement).one_or_none()
    except MultipleResultsFound as exc:
        raise MultipleResultsFound(
            f"Duplicate cashier found for inn={cashier_in.inn!r}, name={cashier_in.name!r}"
        ) from exc

    if not cashier:
        cashier = Cashier(**cashier_in.model_dump())
        session.add(cashier)
    elif cashier.is_active is False:
        cashier.is_active = True
        session.add(cashier)

    session.flush()
    return cashier
