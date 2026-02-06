from sqlmodel import Session, select

from app.models import Cashier, CashierCreate


def get_or_create_cashier(session: Session, cashier_in: CashierCreate):
    """Get an existing cashier by INN/name or create a new one without committing."""
    if not cashier_in.name and not cashier_in.inn:
        return None

    statement = select(Cashier)
    if cashier_in.inn:
        statement = statement.where(Cashier.inn == cashier_in.inn)
    else:
        statement = statement.where(Cashier.name == cashier_in.name)

    cashier = session.exec(statement).first()

    if not cashier:
        cashier = Cashier(**cashier_in.model_dump())
        session.add(cashier)
        session.flush()
    return cashier
