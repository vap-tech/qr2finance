import json
import logging

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from app import crud, services
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


@router.message(Command("shops"))
async def cmd_shops(message: types.Message, db: Session, user: User):
    if not user:
        return await message.answer("❌ Сначала привяжите аккаунт.")

    # Вызываем твой сервис
    shops_stats = services.get_spending_by_retail_shops(
        db, user.id, page=0, page_size=8
    )

    if not shops_stats:
        return await message.answer("🏪 Данные о магазинах не найдены.")

    text = "🏪 **Топ-5 магазинов по тратам:**\n\n"
    for i, shop in enumerate(shops_stats[:5], 1):
        text += f"{i}. **{shop.retail_name or shop.legal_name}**\n"
        text += f"   └ 💰 `{shop.total_amount:,.2f} ₽` ({shop.receipts_count} шт.)\n"

    await message.answer(text, parse_mode="Markdown")


# --- Команда /stats: Общая статистика ---
@router.message(Command("stats"))
async def cmd_stats(message: types.Message, db: Session, user: User):
    if not user:
        return await message.answer("❌ Сначала привяжите аккаунт.")

    stats = services.get_user_total_sum(db, user.id)

    if stats.receipts_count == 0:
        return await message.answer("📊 У вас пока нет чеков для статистики.")

    text = (
        f"📊 **Твоя статистика:**\n\n"
        f"🧾 Всего чеков: `{stats.receipts_count}`\n"
        f"💰 Общая сумма: `{stats.total_sum:,.2f} ₽`\n"
        f"💳 Безнал: `{stats.ecash_total_sum:,.2f} ₽`\n"
        f"💵 Наличные: `{stats.cash_total_sum:,.2f} ₽`"
    )
    await message.answer(text, parse_mode="Markdown")


# --- Команда /top: Топ-5 трат ---
@router.message(Command("top"))
async def cmd_top(message: types.Message, db: Session, user: User):
    if not user:
        return await message.answer("❌ Сначала привяжите аккаунт.")

    # Используем твой метод (берем топ-5 для компактности в ТГ)
    top_items = services.get_top_products(db, user.id, limit=5)

    if not top_items:
        return await message.answer("🛒 Список товаров пока пуст.")

    text = "🔝 **Топ-5 затратных покупок:**\n\n"
    for i, item in enumerate(top_items, 1):
        text += f"{i}. {item.name}\n"
        text += f"   └ 💰 `{item.total_sum:,.2f} ₽` ({item.total_quantity} {item.measure})\n"

    await message.answer(text, parse_mode="Markdown")
