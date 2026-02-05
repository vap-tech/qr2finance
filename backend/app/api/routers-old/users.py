from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.crud import set_user_telegram_id

from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


# POST /set_telegram_id/
@router.post("/set-telegram-id", response_model=schemas.User)
def set_telegram_id(
    request: schemas.TelegramIdRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    telegram_id = request.telegram_id
    result = set_user_telegram_id(db, current_user, telegram_id)
    return result


@router.post(
    "/signup",
    response_model=schemas.User,
    status_code=status.HTTP_201_CREATED,
)
def signup(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=str(user.email))
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    return crud.create_user(db=db, user=user)


# POST /set_telegram_id/
@router.get("/me", response_model=schemas.User)
def get_me(
    current_user: models.User = Depends(get_current_user),
):
    """Получить инфо текущего пользователя"""

    return current_user
