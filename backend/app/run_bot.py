import asyncio
import os

from aiogram import Bot, Dispatcher
from aiogram.types import BotCommand
from dotenv import load_dotenv

from app.bot.handlers import router
from app.bot.middleware import DbSessionMiddleware

load_dotenv()


async def set_commands(bot: Bot):
    commands = [
        BotCommand(command="id", description="Твой идентификатор id"),
        BotCommand(command="stats", description="Общая сумма трат"),
        BotCommand(command="top", description="Топ-5 дорогих товаров"),
        BotCommand(command="last", description="Последние 5 чеков"),
        BotCommand(command="shops", description="Топ магазинов"),
    ]
    await bot.set_my_commands(commands)


async def main():
    # 1. Инициализация (используем TOKEN из .env)
    bot = Bot(token=os.getenv("TELEGRAM_TOKEN", ""))
    dp = Dispatcher()

    # 2. Подсказки
    await set_commands(bot)

    # 2. Регистрация мидлвари
    # Здесь мы не вызываем SessionLocal напрямую,
    # его использует сама мидлварь внутри себя
    # # Попробуй зарегистрировать именно на message
    dp.message.outer_middleware(DbSessionMiddleware())

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
