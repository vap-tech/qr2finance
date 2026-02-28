import logging

from aiogram import Bot, Dispatcher, types
from aiogram.types import BotCommand
from fastapi import HTTPException, Request, status

from app.bot.handlers import router as bot_router
from app.bot.middleware import DbSessionMiddleware
from app.core.config import settings

logger = logging.getLogger(__name__)

_bot: Bot | None = None
_dp: Dispatcher | None = None
_enabled = False


def _public_base_url() -> str:
    domain = settings.DOMAIN.strip().rstrip("/")
    if domain.startswith("http://") or domain.startswith("https://"):
        return domain
    return f"https://{domain}"


def is_bot_webhook_enabled() -> bool:
    return _enabled


async def _set_commands(bot: Bot) -> None:
    commands = [
        BotCommand(command="start", description="Статус подключения"),
        BotCommand(command="id", description="Показать Telegram ID"),
        BotCommand(command="last", description="Последние 5 чеков"),
    ]
    await bot.set_my_commands(commands)


async def init_bot_webhook() -> None:
    global _bot, _dp, _enabled

    token = settings.TELEGRAM_TOKEN.strip()
    secret = settings.BOT_SECRET_TOKEN.strip()
    domain = settings.DOMAIN.strip()

    if not token or not secret or not domain:
        logger.info(
            "Telegram webhook disabled (TELEGRAM_TOKEN/BOT_SECRET_TOKEN/DOMAIN not fully configured)"
        )
        _enabled = False
        return

    _bot = Bot(token=token)
    _dp = Dispatcher()
    _dp.message.outer_middleware(DbSessionMiddleware())
    _dp.include_router(bot_router)

    await _set_commands(_bot)
    webhook_url = f"{_public_base_url()}{settings.API_V1_STR}/telegram/webhook"
    allowed_updates = _dp.resolve_used_update_types()

    await _bot.set_webhook(
        url=webhook_url,
        secret_token=secret,
        allowed_updates=allowed_updates,
        drop_pending_updates=False,
    )
    _enabled = True
    logger.info("Telegram webhook set to %s", webhook_url)


async def shutdown_bot_webhook() -> None:
    global _bot, _dp, _enabled

    if _bot is None:
        _enabled = False
        return

    try:
        await _bot.delete_webhook(drop_pending_updates=False)
        logger.info("Telegram webhook deleted")
    finally:
        await _bot.session.close()
        _bot = None
        _dp = None
        _enabled = False


async def handle_bot_webhook(request: Request) -> dict[str, bool]:
    if not _enabled or _bot is None or _dp is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram webhook is disabled",
        )

    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if secret != settings.BOT_SECRET_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    update = types.Update.model_validate(await request.json(), context={"bot": _bot})
    await _dp.feed_update(_bot, update)
    return {"ok": True}
