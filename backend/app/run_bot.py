import asyncio
import os

from aiogram import Bot, Dispatcher
from dotenv import load_dotenv

# Твои импорты
from app.bot.handlers import router
from app.bot.middleware import DbSessionMiddleware

load_dotenv()


async def main():
    # 1. Инициализация (используем TOKEN из .env)
    bot = Bot(token=os.getenv("TELEGRAM_TOKEN", ""))
    dp = Dispatcher()

    # 2. Регистрация мидлвари
    # Здесь мы не вызываем SessionLocal напрямую,
    # его использует сама мидлварь внутри себя
    # # Попробуй зарегистрировать именно на message
    dp.message.outer_middleware(DbSessionMiddleware())
    dp.update.outer_middleware(DbSessionMiddleware())

    # 3. Регистрация роутера с хэндлерами
    dp.include_router(router)

    print("🚀 Бот запущен в режиме Polling...")
    print("Отправь JSON-файл боту для проверки.")

    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
