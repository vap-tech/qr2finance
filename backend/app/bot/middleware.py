import logging
from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject
from app.database import SessionLocal  # Твой импорт сессии
from app.models import User  # Твоя модель пользователя
from sqlalchemy.orm import Session

# Настраиваем логирование, если еще не настроено
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DbSessionMiddleware(BaseMiddleware):
    """
    Мидлварь для обеспечения хэндлеров сессией БД
    и автоматического поиска пользователя.
    Поддерживает все типы событий с from_user.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        # 1. Открываем сессию базы данных
        with SessionLocal() as db:
            db: Session
            user = None

            # 2. Пытаемся получить from_user из любого события
            try:
                from_user = getattr(event, "from_user", None)
                if from_user:
                    # Ищем юзера по telegram_id
                    user = (
                        db.query(User)
                        .filter(User.telegram_id == str(from_user.id))
                        .first()
                    )
            except Exception as e:
                logger.warning(f"Не удалось получить пользователя: {e}")

            # 3. Прокидываем данные в хэндлер
            data["db"] = db
            data["user"] = user

            # 4. Выполняем хэндлер
            try:
                return await handler(event, data)
            except Exception as e:
                logger.error(f"Ошибка в хендлере: {e}")
                raise
