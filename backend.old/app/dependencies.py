from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select
from . import auth
from .database import get_db
from .models import User

security = HTTPBearer()


def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db)
):
    token = credentials.credentials

    # 1. Декодируем токен
    # auth.decode_token должен возвращать ID или None (или выбрасывать ошибку)
    user_id = auth.decode_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Ищем пользователя.
    query = select(User).where(User.id == int(user_id))
    user = db.execute(query).scalar_one_or_none()

    # 3. Проверка существования и активности
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,  # 403 лучше подходит для деактивированных
            detail="User is inactive",
        )

    return user
