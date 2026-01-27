import logging
from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware
from aiogram.types import Message, TelegramObject
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
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        # 1. Открываем сессию базы данных
        with SessionLocal() as db:
            db: Session  # Вот здесь мы явно использовали импорт
            # 2. Проверяем, что событие — это сообщение
            if isinstance(event, Message) and event.from_user:
                # Ищем юзера по telegram_id (преобразуем в str, как в модели)
                user = (
                    db.query(User)
                    .filter(User.telegram_id == str(event.from_user.id))
                    .first()
                )

                # Прокидываем данные в хэндлер через словарь data
                data["db"] = db
                data["user"] = user
            else:
                data["db"] = db
                data["user"] = None

            # 3. Выполняем хэндлер
            return await handler(event, data)
            # Сессия закроется автоматически при выходе из with
