import logging
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject
from sqlmodel import Session, select

from app.core.db import engine
from app.models import User

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
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # 1. Открываем сессию базы данных.
        with Session(engine) as db:
            user = None

            # 2. Пытаемся получить from_user из любого события.
            try:
                from_user = getattr(event, "from_user", None)
                if from_user:
                    statement = select(User).where(
                        User.telegram_id == str(from_user.id)
                    )
                    user = db.exec(statement).first()
            except Exception as exc:
                logger.warning("Не удалось получить пользователя: %s", exc)

            # 3. Прокидываем данные в хэндлер.
            data["db"] = db
            data["user"] = user

            # 4. Выполняем хэндлер.
            try:
                return await handler(event, data)
            except Exception as exc:
                logger.error("Ошибка в хендлере: %s", exc)
                raise
