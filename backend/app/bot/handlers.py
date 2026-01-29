import json
import logging

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from app import crud, models, services
from app.models import User
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, joinedload

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
        receipt = crud.create_receipt_with_backup(
            db, receipt_json, user_id=user.id, import_method="telegram_bot"
        )

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


@router.message(Command("last"))
async def cmd_last(message: types.Message, db: Session, user: User):
    """
    Показывает последние 5 загруженных чеков
    """
    if not user:
        return await message.answer("❌ Сначала привяжите аккаунт.")

    try:
        # Получаем последние 5 чеков
        recent_receipts = crud.get_recent_receipts(
            db=db,
            user_id=user.id,
            limit=5,
            with_items=True,  # Чтобы показать товары
        )

        if not recent_receipts:
            return await message.answer("📭 У вас еще нет загруженных чеков.")

        # Формируем сообщение
        text = "📋 **Последние 5 чеков:**\n\n"

        for i, receipt in enumerate(recent_receipts, 1):
            # Получаем магазин для чека
            shop_name = (
                receipt.shop.retail_name or receipt.shop.legal_name
                if receipt.shop
                else "Неизвестный магазин"
            )

            # Форматируем дату
            date_str = receipt.date_time.strftime("%d.%m.%Y %H:%M")

            # Сумма в рублях
            total_rub = receipt.total_sum / 100

            # Превью товаров (первые 2)
            items_preview = ""
            if receipt.items:
                items = receipt.items[:2]
                items_list = []
                for item in items:
                    name = item.name[:20] + "..." if len(item.name) > 20 else item.name
                    items_list.append(name)
                items_preview = " | ".join(items_list)
                if len(receipt.items) > 2:
                    items_preview += f" +{len(receipt.items) - 2} ещё"

            text += (
                f"**{i}. {date_str}**\n"
                f"🏪 *{shop_name[:30]}...*\n"
                f"💰 *{total_rub:,.2f} ₽* ({len(receipt.items)} шт.)\n"
            )

            if items_preview:
                text += f"🛒 {items_preview}\n"

            # Разделитель между чеками
            if i < len(recent_receipts):
                text += "―" * 30 + "\n"

        # Получаем общее количество чеков пользователя
        total_receipts_count = db.execute(
            select(func.count(models.Receipt.id)).where(
                models.Receipt.user_id == user.id
            )
        ).scalar()

        # Добавляем статистику
        text += f"\n📊 Всего чеков: {total_receipts_count}"

        # Создаем инлайн-кнопки для навигации
        keyboard = []

        # Если есть больше 5 чеков, добавляем кнопку "Ещё"
        if total_receipts_count and total_receipts_count > 5:
            keyboard.append(
                [
                    types.InlineKeyboardButton(
                        text="📜 Показать ещё", callback_data="more_receipts"
                    )
                ]
            )

        # Кнопка для статистики
        keyboard.append(
            [
                types.InlineKeyboardButton(text="📊 Статистика", callback_data="stats"),
                types.InlineKeyboardButton(text="🏪 Магазины", callback_data="shops"),
            ]
        )

        reply_markup = types.InlineKeyboardMarkup(inline_keyboard=keyboard)

        await message.answer(text, parse_mode="Markdown", reply_markup=reply_markup)

    except Exception as e:
        logger.error(f"Ошибка в cmd_last: {e}")
        await message.answer("❌ Произошла ошибка при получении чеков.")


@router.callback_query(F.data == "more_receipts")
async def callback_more_receipts(
    callback: types.CallbackQuery, db: Session, user: User
):
    """
    Показывает следующие 5 чеков
    """
    if not user:
        return await callback.answer("❌ Сначала привяжите аккаунт.", show_alert=True)

    try:
        # Можно передавать offset через callback data
        # "more_receipts_5" где 5 - уже показано
        offset = 5  # Уже показали первые 5

        # Получаем следующие 5
        receipts = (
            db.execute(
                select(models.Receipt)
                .where(models.Receipt.user_id == user.id)
                .order_by(desc(models.Receipt.created_at))
                .offset(offset)
                .limit(5)
                .options(joinedload(models.Receipt.shop))
            )
            .scalars()
            .all()
        )

        if not receipts:
            return await callback.answer("Больше чеков нет", show_alert=True)

        text = "📋 **Следующие чеки:**\n\n"

        for i, receipt in enumerate(receipts, offset + 1):
            shop_name = (
                receipt.shop.retail_name or receipt.shop.legal_name
                if receipt.shop
                else "Неизвестно"
            )

            text += (
                f"**{i}. {receipt.date_time.strftime('%d.%m.%Y %H:%M')}**\n"
                f"🏪 {shop_name[:25]}...\n"
                f"💰 {receipt.total_sum / 100:,.2f} ₽\n"
                f"―" * 25 + "\n"
            )

        # Кнопка "Назад" если нужно
        keyboard = [
            [types.InlineKeyboardButton(text="⬅️ Назад", callback_data="last_receipts")]
        ]

        reply_markup = types.InlineKeyboardMarkup(inline_keyboard=keyboard)

        await callback.message.edit_text(
            text, parse_mode="Markdown", reply_markup=reply_markup
        )

        await callback.answer()

    except Exception as e:
        logger.error(f"Ошибка в callback_more_receipts: {e}")
        await callback.answer("❌ Ошибка", show_alert=True)


@router.callback_query(F.data.startswith("receipt_detail_"))
async def callback_receipt_detail(
    callback: types.CallbackQuery, db: Session, user: User
):
    """
    Показывает детали конкретного чека
    """
    if not user:
        return await callback.answer("❌ Сначала привяжите аккаунт.", show_alert=True)

    try:
        receipt_id = int(callback.data.split("_")[-1])

        receipt = db.execute(
            select(models.Receipt)
            .where(models.Receipt.id == receipt_id, models.Receipt.user_id == user.id)
            .options(
                joinedload(models.Receipt.shop),
                joinedload(models.Receipt.items),
                joinedload(models.Receipt.cashier),
            )
        ).scalar_one_or_none()

        if not receipt:
            return await callback.answer("Чек не найден", show_alert=True)

        shop = receipt.shop
        shop_name = shop.retail_name or shop.legal_name if shop else "Неизвестно"
        address = shop.address[:50] + "..." if shop and shop.address else ""

        # Форматируем детальное сообщение
        text = (
            f"🧾 **Детали чека**\n"
            f"📅 *Дата:* {receipt.date_time.strftime('%d.%m.%Y %H:%M')}\n"
            f"🏪 *Магазин:* {shop_name}\n"
        )

        if address:
            text += f"📍 *Адрес:* {address}\n"

        if receipt.cashier and receipt.cashier.name:
            text += f"👤 *Кассир:* {receipt.cashier.name}\n"

        text += f"\n💰 *Итого:* {receipt.total_sum / 100:,.2f} ₽\n"

        # Оплата
        if receipt.cash_total_sum > 0:
            text += f"💵 Наличные: {receipt.cash_total_sum / 100:,.2f} ₽\n"
        if receipt.ecash_total_sum > 0:
            text += f"💳 Безнал: {receipt.ecash_total_sum / 100:,.2f} ₽\n"

        # НДС если есть
        if receipt.nds_10 or receipt.nds_18:
            text += "\n📊 *НДС:* "
            nds_parts = []
            if receipt.nds_10:
                nds_parts.append(f"10% = {receipt.nds_10 / 100:,.2f} ₽")
            if receipt.nds_18:
                nds_parts.append(f"18% = {receipt.nds_18 / 100:,.2f} ₽")
            text += ", ".join(nds_parts) + "\n"

        # Товары
        if receipt.items:
            text += f"\n🛒 *Товары ({len(receipt.items)}):*\n"

            for item in receipt.items[:10]:  # Показываем первые 10
                item_sum_rub = item.sum / 100
                item_price_rub = item.price / 100
                text += (
                    f"• {item.name[:35]}...\n"
                    f"  {item.quantity} {item.measure} × {item_price_rub:,.2f}₽ = {item_sum_rub:,.2f}₽\n"
                )

            if len(receipt.items) > 10:
                text += f"\n... и еще {len(receipt.items) - 10} товаров\n"

        # Фискальные данные
        text += f"\n🧾 *ФН:* {receipt.fiscal_drive_number}\n"
        text += f"📄 *Док. №:* {receipt.fiscal_document_number}\n"
        text += f"🔢 *Подпись:* {receipt.fiscal_sign}\n"

        # Кнопки
        keyboard = [
            [
                types.InlineKeyboardButton(
                    text="⬅️ Назад к списку", callback_data="last_receipts"
                ),
                types.InlineKeyboardButton(
                    text="📋 Сырые данные", callback_data=f"raw_data_{receipt.id}"
                ),
            ]
        ]

        reply_markup = types.InlineKeyboardMarkup(inline_keyboard=keyboard)

        await callback.message.edit_text(
            text, parse_mode="Markdown", reply_markup=reply_markup
        )

        await callback.answer()

    except Exception as e:
        logger.error(f"Ошибка в callback_receipt_detail: {e}")
        await callback.answer("❌ Ошибка", show_alert=True)


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
