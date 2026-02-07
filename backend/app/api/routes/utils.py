from fastapi import APIRouter, Depends
from pydantic.networks import EmailStr
from sqlmodel import select

from app.api.deps import SessionDep, get_current_active_superuser
from app.models import HealthCheck, Message
from app.utils import generate_test_email, send_email

router = APIRouter(prefix="/utils", tags=["utils"])


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """
    Test emails.
    """
    email_data = generate_test_email(email_to=email_to)
    send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")


@router.get("/health-check/", response_model=HealthCheck)
def health_check(session: SessionDep) -> HealthCheck:
    db_ok = False
    try:
        session.exec(select(1)).one()
        db_ok = True
    except Exception:
        db_ok = False
    return HealthCheck(app=db_ok, database=db_ok)
