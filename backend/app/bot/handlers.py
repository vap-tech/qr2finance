import json
import logging
from datetime import timezone
from html import escape
from typing import Any

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlmodel import Session, select

from app.api.routes.receipts import _create_receipt_from_raw_payload
from app.models import Receipt, ReceiptItem, Shop, User

router = Router()
logger = logging.getLogger(__name__)


def _fmt_money_kopeks(value: int) -> str:
    rub = value / 100
    return f"{rub:,.2f}".replace(",", " ")


def _fmt_dt_local(value) -> str:
    local_dt = value.astimezone(timezone.utc).astimezone()
    return local_dt.strftime("%d.%m.%Y %H:%M")


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


@router.message(Command("last"))
async def cmd_last(message: types.Message, db: Session, user: User | None) -> None:
    if user is None:
        await message.answer(
            "Ваш Telegram ID не привязан к аккаунту.\n"
            "Сначала укажите Telegram ID в профиле на сайте."
        )
        return

    receipts = db.exec(
        select(Receipt)
        .where(Receipt.owner_id == user.id)
        .order_by(desc(Receipt.date_time))
        .limit(5)
    ).all()

    if not receipts:
        await message.answer("У вас пока нет загруженных чеков.")
        return

    total_count = db.exec(
        select(func.count()).select_from(Receipt).where(Receipt.owner_id == user.id)
    ).one()

    lines: list[str] = ["<b>Последние 5 чеков</b>", ""]
    for idx, receipt in enumerate(receipts, start=1):
        shop = db.get(Shop, receipt.shop_id)
        shop_name = "Неизвестный магазин"
        if shop is not None:
            shop_name = (shop.retail_name or shop.address or shop_name).strip()
        item_count = db.exec(
            select(func.count())
            .select_from(ReceiptItem)
            .where(ReceiptItem.receipt_id == receipt.id)
        ).one()

        lines.append(
            f"🕒 <b>{_fmt_dt_local(receipt.date_time)}</b>\n"
            f"└ 📍 {escape(shop_name)}\n"
            f"└ 💰 {_fmt_money_kopeks(receipt.total_sum)} ₽ · позиций: {int(item_count)}"
        )
        if idx != len(receipts):
            lines.append("────────────────")

    lines.extend(["", f"Всего чеков: <b>{int(total_count)}</b>"])
    await message.answer("\n".join(lines), parse_mode="HTML")


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
        receipt = created.receipt
        first_item_preview = ""
        if created.items:
            first_name = created.items[0].name
            preview = first_name[:64] + ("..." if len(first_name) > 64 else "")
            first_item_preview = f"\n🛒 Первая позиция: {escape(preview)}"

        response = (
            "<b>Чек успешно загружен</b>\n"
            f"🧾 ID: <code>{receipt.id}</code>\n"
            f"📅 Дата: {_fmt_dt_local(receipt.date_time)}\n"
            f"💳 Сумма: {_fmt_money_kopeks(receipt.total_sum)} ₽\n"
            f"📦 Позиций: {len(created.items)}"
            f"{first_item_preview}\n\n"
            "Команда <code>/last</code> покажет последние чеки."
        )
        await message.answer(response, parse_mode="HTML")
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
