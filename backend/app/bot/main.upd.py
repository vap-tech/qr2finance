import os
from contextlib import asynccontextmanager

from aiogram import Bot, Dispatcher, types
from dotenv import load_dotenv
from fastapi import FastAPI, Request

from app.bot.handlers import router as bot_router
from app.bot.middleware import DbSessionMiddleware

load_dotenv("./..")

# Настройки из .env
TOKEN = os.getenv("TELEGRAM_TOKEN", "")
DOMAIN = os.getenv("DOMAIN", "")
# Придумай секретный токен для защиты эндпоинта
SECRET_TOKEN = os.getenv("BOT_SECRET_TOKEN", "")

bot = Bot(token=TOKEN)
dp = Dispatcher()

# Регистрация той самой мидлвари и роутера
dp.message.outer_middleware(DbSessionMiddleware())
dp.include_router(bot_router)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Установка вебхука при запуске сервера
    webhook_url = f"https://{DOMAIN}/bot/{TOKEN}"
    await bot.set_webhook(
        url=webhook_url, secret_token=SECRET_TOKEN, allowed_updates=["message"]
    )
    yield
    # Удаление вебхука при остановке
    await bot.delete_webhook()


app = FastAPI(lifespan=lifespan)


@app.post(f"/bot/{TOKEN}")
async def bot_webhook(request: Request):
    # Проверка, что запрос пришел именно от Telegram
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != SECRET_TOKEN:
        return {"status": "error", "message": "Unauthorized"}

    update = types.Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


# Твои старые эндпоинты
# app.include_router(...)
