# bot/src/bot.py
import asyncio
import logging
import os
from typing import Optional

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import Message
from pydantic import BaseModel, ValidationError
import json

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Получаем токен из переменных окружения
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
if not TELEGRAM_TOKEN:
    logger.error("TELEGRAM_TOKEN не установлен!")
    exit(1)

# Инициализация бота и диспетчера
bot = Bot(token=TELEGRAM_TOKEN)
dp = Dispatcher()


# Модель для валидации чека (упрощенная)
class ReceiptItem(BaseModel):
    name: str
    price: int  # в копейках
    quantity: float
    sum: int  # в копейках


class ReceiptData(BaseModel):
    totalSum: int
    dateTime: str
    items: list[ReceiptItem]


# Хранилище (временное, потом заменим на БД)
user_receipts = {}


# Команда /start
@dp.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(
        "👋 Привет! Я бот для учета расходов по чекам.\n\n"
        "Как пользоваться:\n"
        "1. 📸 Сканируй QR-код с чека в приложении ФНС\n"
        "2. 📱 Нажимай 'Поделиться' и выбирай этого бота\n"
        "3. 📊 Я автоматически сохраню твой чек\n\n"
        "Команды:\n"
        "/start - это сообщение\n"
        "/help - помощь\n"
        "/last - последний чек\n"
        "/stats - статистика\n"
    )


# Команда /help
@dp.message(Command("help"))
async def cmd_help(message: Message):
    await message.answer(
        "ℹ️ **Помощь по использованию бота:**\n\n"
        "1. **Добавление чека:**\n"
        "   - Откройте приложение ФНС 'Проверка чека'\n"
        "   - Отсканируйте QR-код с бумажного чека\n"
        "   - Нажмите 'Поделиться' → выберите этого бота\n\n"
        "2. **Просмотр статистики:**\n"
        "   - /last - показать последний чек\n"
        "   - /stats - статистика по расходам\n\n"
        "3. **Проблемы?**\n"
        "   - Убедитесь, что в JSON есть поля 'totalSum', 'items'\n"
        "   - Если чек не распознается, отправьте его как файл .json"
    )


# Команда /last - последний чек
@dp.message(Command("last"))
async def cmd_last(message: Message):
    user_id = message.from_user.id
    receipts = user_receipts.get(user_id, [])

    if not receipts:
        await message.answer("📭 У вас еще нет сохраненных чеков.")
        return

    last_receipt = receipts[-1]
    response = (
        f"📋 **Последний чек:**\n\n"
        f"🏪 {last_receipt['store']}\n"
        f"📅 {last_receipt['date']}\n"
        f"💰 {last_receipt['total']:.2f} ₽\n"
        f"🛒 Товаров: {last_receipt['items_count']}"
    )
    await message.answer(response)


# Команда /stats - статистика
@dp.message(Command("stats"))
async def cmd_stats(message: Message):
    user_id = message.from_user.id
    receipts = user_receipts.get(user_id, [])

    if not receipts:
        await message.answer("📊 Статистика пуста. Добавьте первый чек!")
        return

    total_spent = sum(r['total'] for r in receipts)
    avg_receipt = total_spent / len(receipts)

    response = (
        f"📊 **Ваша статистика:**\n\n"
        f"📈 Всего чеков: {len(receipts)}\n"
        f"💰 Всего потрачено: {total_spent:.2f} ₽\n"
        f"📊 Средний чек: {avg_receipt:.2f} ₽\n"
        f"📅 Первый чек: {receipts[0]['date']}\n"
        f"🔄 Последний чек: {receipts[-1]['date']}"
    )
    await message.answer(response)


# Обработка JSON чеков (основная функция!)
@dp.message(F.document | F.text)
async def handle_receipt(message: Message):
    try:
        # Получаем JSON из сообщения
        if message.document:
            # Если прислали файл .json
            file = await bot.get_file(message.document.file_id)
            file_bytes = await bot.download_file(file.file_path)
            json_text = file_bytes.read().decode('utf-8')
        else:
            # Если прислали текстом
            json_text = message.text

        # Парсим JSON
        data = json.loads(json_text)

        # Валидируем структуру (упрощенно)
        if isinstance(data, list) and len(data) > 0:
            receipt_data = data[0].get('ticket', {}).get('document', {}).get('receipt', {})
        else:
            receipt_data = data.get('receipt', data)

        if not receipt_data:
            await message.answer("❌ Не удалось найти данные чека в JSON")
            return

        # Извлекаем основные данные
        total_sum = receipt_data.get('totalSum', 0) / 100  # в рубли
        items = receipt_data.get('items', [])
        store = receipt_data.get('retailPlace', 'Неизвестный магазин')
        date = receipt_data.get('dateTime', '').replace('T', ' ')[:19]

        # Сохраняем в "базу" (пока что в памяти)
        user_id = message.from_user.id
        if user_id not in user_receipts:
            user_receipts[user_id] = []

        receipt_info = {
            'total': total_sum,
            'store': store,
            'date': date,
            'items_count': len(items)
        }
        user_receipts[user_id].append(receipt_info)

        # Формируем ответ
        response = (
            f"✅ **Чек успешно сохранен!**\n\n"
            f"🏪 Магазин: {store}\n"
            f"📅 Дата: {date}\n"
            f"💰 Сумма: {total_sum:.2f} ₽\n"
            f"🛒 Товаров: {len(items)}\n\n"
        )

        # Добавляем топ-3 самых дорогих товара
        if items:
            sorted_items = sorted(items, key=lambda x: x.get('sum', 0), reverse=True)[:3]
            response += "**Самые дорогие покупки:**\n"
            for item in sorted_items:
                name = item.get('name', 'Неизвестно')[:30]
                if len(name) == 30:
                    name += "..."
                price = item.get('sum', 0) / 100
                response += f"• {name}: {price:.2f} ₽\n"

        await message.answer(response)

        # Логируем успех
        logger.info(f"Чек сохранен для пользователя {user_id}: {total_sum}₽")

    except json.JSONDecodeError:
        await message.answer(
            "❌ Это не похоже на JSON чек.\n\n"
            "Убедитесь, что:\n"
            "1. Вы сканировали QR-код в приложении ФНС\n"
            "2. Нажали 'Поделиться' и выбрали этого бота\n"
            "3. Отправляете именно JSON, а не текст или фото"
        )
    except Exception as e:
        logger.error(f"Ошибка обработки чека: {e}", exc_info=True)
        await message.answer(f"⚠️ Произошла ошибка: {str(e)}")


# Обработка неизвестных команд
@dp.message()
async def unknown_message(message: Message):
    await message.answer(
        "🤔 Я не понимаю эту команду.\n"
        "Используйте /start для начала работы или /help для помощи."
    )


# Основная функция запуска
async def main():
    logger.info("Бот запускается...")

    # Пропускаем накопившиеся обновления
    await bot.delete_webhook(drop_pending_updates=True)

    # Запускаем поллинг
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())