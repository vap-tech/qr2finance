from fastapi import APIRouter, Request

from app.bot.webhook import handle_bot_webhook

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(request: Request) -> dict[str, bool]:
    return await handle_bot_webhook(request)
