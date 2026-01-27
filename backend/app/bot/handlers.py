import json
import logging

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from app import crud
from app.models import User
from sqlalchemy.orm import Session

# Настраиваем роутер
router = Router()
logger = logging.getLogger(__name__)


@router.message(Command("id"))
async def get_my_id(message: types.Message):
    await message.answer(f"Твой Telegram ID: `{message.from_user.id}`")


@router.message(F.document.file_name.endswith(".json"))
async def handle_receipt_json(
    message: types.Message, bot: Bot, db: Session, user: User
):
    """
    Аналог эндпоинта @router.post("/upload-json") для Telegram.
    Принимает JSON-файл чека, парсит и сохраняет в БД.
    """
    # 1. Проверка авторизации (связан ли telegram_id)
    if not user:
        return await message.answer(
            "❌ Вы не зарегистрированы в системе или не привязали Telegram ID.\n"
            "Пожалуйста, сделайте это в профиле на сайте space-flow.dev"
        )

    # 2. Получаем файл из сообщения
    document = message.document

    # Визуальный отклик, что работа началась
    await message.bot.send_chat_action(message.chat.id, "upload_document")

    try:
        # 3. Скачиваем файл в память (в буфер)
        file_info = await bot.get_file(document.file_id)
        file_content = await bot.download_file(file_info.file_path)

        # 4. Декодируем и парсим JSON
        # Мы используем .read(), так как download_file возвращает BytesIO
        data = json.load(file_content)

        # 5. Логика обработки списка или одиночного объекта (как в твоем коде)
        if isinstance(data, list):
            # Берем первый чек из списка
            receipt_json = data[0] if len(data) > 0 else None
        else:
            receipt_json = data

        if not receipt_json:
            return await message.reply("⚠️ Файл пуст или содержит некорректные данные.")

        # 6. Вызываем твой CRUD метод
        # Передаем db и user.id, которые прокинула мидлварь
        receipt = crud.create_receipt_full(db, receipt_json, user_id=user.id)

        # 7. Извлекаем данные для красивого ответа (как в твоем API)
        ticket_data = (
            receipt_json.get("ticket", {}).get("document", {}).get("receipt", {})
        )
        items_count = len(ticket_data.get("items", []))

        await message.reply(
            f"✅ **Чек успешно загружен!**\n\n"
            f"🔹 ID чека: `{receipt.id}`\n"
            f"🔹 Внешний ID: `{receipt.external_id}`\n"
            f"🔹 Позиций обработано: {len(receipt.items)}\n"
            f"🔹 Позиций в файле: {items_count}\n\n"
            f"📊 Чек доступен в вашем личном кабинете."
        )

    except json.JSONDecodeError:
        await message.reply("❌ Ошибка: Файл не является валидным JSON.")
    except Exception as e:
        logger.error(f"Error processing TG receipt: {e}", exc_info=True)
        await message.reply(f"❌ Произошла ошибка при обработке чека: {str(e)}")


@router.message(F.document)
async def handle_wrong_file_type(message: types.Message):
    """Отлавливает файлы, которые не JSON"""
    await message.reply("⚠️ Я принимаю только файлы формата **.json**")
