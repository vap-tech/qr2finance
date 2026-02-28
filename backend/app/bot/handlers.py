import json
import logging
from typing import Any

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes.receipts import _create_receipt_from_raw_payload
from app.models import User

router = Router()
logger = logging.getLogger(__name__)


@router.message(Command("start"))
async def cmd_start(message: types.Message, user: User | None) -> None:
    if user is None:
        await message.answer(
            "Бот подключен.\n"
            "Ваш Telegram ID пока не привязан к аккаунту.\n"
            "Укажите Telegram ID в профиле на сайте и отправьте JSON-чек."
        )
        return
    await message.answer(
        "Бот подключен и готов принимать JSON-файлы чеков.\nОтправьте файл .json в чат."
    )


@router.message(Command("id"))
async def cmd_id(message: types.Message) -> None:
    telegram_id = message.from_user.id if message.from_user else "unknown"
    await message.answer(f"Telegram ID: {telegram_id}")


def _pick_payload(parsed: Any) -> dict[str, Any] | list[dict[str, Any]]:
    if isinstance(parsed, list):
        if len(parsed) == 0:
            raise ValueError("Пустой JSON-массив")
        first = parsed[0]
        if not isinstance(first, dict):
            raise ValueError("Первый элемент массива должен быть объектом")
        return parsed
    if not isinstance(parsed, dict):
        raise ValueError("JSON должен быть объектом или массивом объектов")
    return parsed


@router.message(F.document.file_name.endswith(".json"))
async def handle_receipt_json(
    message: types.Message,
    bot: Bot,
    db: Session,
    user: User | None,
) -> None:
    if user is None:
        await message.answer(
            "Вы не привязаны к аккаунту.\n"
            "Добавьте Telegram ID в профиле на сайте, затем отправьте файл снова."
        )
        return

    document = message.document
    if document is None:
        await message.answer("Не удалось получить файл. Повторите отправку.")
        return

    await message.bot.send_chat_action(message.chat.id, "upload_document")

    try:
        file_info = await bot.get_file(document.file_id)
        file_content = await bot.download_file(file_info.file_path)
        parsed = json.load(file_content)
        payload = _pick_payload(parsed)

        created = _create_receipt_from_raw_payload(
            session=db,
            current_user=user,
            payload=payload,
        )
        receipt_id = created.receipt.id
        items_count = len(created.items)
        await message.answer(
            f"Чек успешно загружен.\nID: {receipt_id}\nПозиций: {items_count}"
        )
    except json.JSONDecodeError:
        await message.answer("Файл не является валидным JSON.")
    except HTTPException as exc:
        await message.answer(f"Не удалось обработать чек: {exc.detail}")
    except ValueError as exc:
        await message.answer(f"Не удалось обработать чек: {exc}")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error processing telegram receipt: %s", exc)
        await message.answer("Внутренняя ошибка при обработке чека.")


@router.message(F.document)
async def handle_wrong_file_type(message: types.Message) -> None:
    await message.answer("Поддерживаются только файлы .json")
