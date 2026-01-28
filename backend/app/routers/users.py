from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
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


# POST /set_telegram_id/
@router.get("/me", response_model=schemas.User)
def get_me(
    current_user: models.User = Depends(get_current_user),
):
    """Получить инфо текущего пользователя"""

    return current_user
