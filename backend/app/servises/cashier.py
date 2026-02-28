from sqlalchemy.exc import MultipleResultsFound
from sqlmodel import Session, select

from app.models import Cashier, CashierCreate

UNKNOWN_CASHIER_INN = "000000000000"


def get_or_create_cashier(session: Session, cashier_in: CashierCreate):
    """Get an existing cashier by INN/name or create a new one without committing."""
    if cashier_in.name is None:
        return None

    name = cashier_in.name.strip()
    if name == "":
        return None
    inn = (
        cashier_in.inn.strip()
        if cashier_in.inn is not None and cashier_in.inn.strip() != ""
        else UNKNOWN_CASHIER_INN
    )

    statement = select(Cashier).where(
        Cashier.inn == inn,
        Cashier.name == name,
    )

    try:
        cashier = session.exec(statement).one_or_none()
    except MultipleResultsFound as exc:
        raise MultipleResultsFound(
            f"Duplicate cashier found for inn={inn!r}, name={name!r}"
        ) from exc

    if not cashier:
        cashier = Cashier(name=name, inn=inn)
        session.add(cashier)

    if cashier.is_active is False:
        cashier.is_active = True
        session.add(cashier)

    session.flush()
    return cashier
