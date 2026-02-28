import json
import logging
import uuid
from collections.abc import Sequence
from datetime import timezone
from html import escape
from time import monotonic
from typing import Any

from aiogram import Bot, F, Router, types
from aiogram.filters import Command
from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlmodel import Session, col, select

from app.api.routes.receipts import _create_receipt_from_raw_payload
from app.models import Receipt, ReceiptItem, Shop, User

router = Router()
logger = logging.getLogger(__name__)

_THROTTLE: dict[tuple[str, int], float] = {}


def _fmt_money_kopeks(value: int) -> str:
    rub = value / 100
    return f"{rub:,.2f}".replace(",", " ")


def _fmt_dt_local(value) -> str:
    local_dt = value.astimezone(timezone.utc).astimezone()
    return local_dt.strftime("%d.%m.%Y %H:%M")


def _safe_detail(detail: Any) -> str:
    if isinstance(detail, str):
        return escape(detail)
    return escape(json.dumps(detail, ensure_ascii=False))


def _throttle_remaining(key: str, tg_id: int, seconds: int) -> int:
    now = monotonic()
    slot = (key, tg_id)
    last = _THROTTLE.get(slot)
    if last is None or (now - last) >= seconds:
        _THROTTLE[slot] = now
        return 0
    return max(1, int(seconds - (now - last)))


async def _throttle_message(message: types.Message, *, key: str, seconds: int) -> bool:
    from_user = message.from_user
    if from_user is None:
        return False
    wait = _throttle_remaining(key, from_user.id, seconds)
    if wait <= 0:
        return False
    await message.answer(f"⏳ Подождите {wait} сек.")
    return True


async def _throttle_callback(
    callback: types.CallbackQuery, *, key: str, seconds: int
) -> bool:
    from_user = callback.from_user
    wait = _throttle_remaining(key, from_user.id, seconds)
    if wait <= 0:
        return False
    await callback.answer(f"Подождите {wait} сек.", show_alert=False)
    return True


def _build_last_keyboard(receipts: Sequence[Receipt]) -> types.InlineKeyboardMarkup:
    rows: list[list[types.InlineKeyboardButton]] = []
    for receipt in receipts:
        rows.append(
            [
                types.InlineKeyboardButton(
                    text=f"🧾 {_fmt_dt_local(receipt.date_time)}",
                    callback_data=f"rcpt:{receipt.id}",
                )
            ]
        )
    rows.append(
        [
            types.InlineKeyboardButton(
                text="🔄 Обновить", callback_data="last:refresh"
            ),
        ]
    )
    return types.InlineKeyboardMarkup(inline_keyboard=rows)


def _build_last_text(db: Session, user: User, receipts: Sequence[Receipt]) -> str:
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
    return "\n".join(lines)


def _build_receipt_details_text(db: Session, receipt: Receipt) -> str:
    shop = db.get(Shop, receipt.shop_id)
    shop_name = "Неизвестный магазин"
    if shop is not None:
        shop_name = (shop.retail_name or shop.address or shop_name).strip()

    items = db.exec(
        select(ReceiptItem)
        .where(col(ReceiptItem.receipt_id) == receipt.id)
        .order_by(col(ReceiptItem.sum).desc())
        .limit(5)
    ).all()

    item_count = db.exec(
        select(func.count())
        .select_from(ReceiptItem)
        .where(ReceiptItem.receipt_id == receipt.id)
    ).one()

    lines = [
        "<b>Детали чека</b>",
        "",
        f"🧾 ID: <code>{receipt.id}</code>",
        f"🕒 Дата: <b>{_fmt_dt_local(receipt.date_time)}</b>",
        f"📍 Магазин: {escape(shop_name)}",
        f"💰 Сумма: <b>{_fmt_money_kopeks(receipt.total_sum)} ₽</b>",
        f"📦 Позиций: {int(item_count)}",
    ]

    if items:
        lines.extend(["", "<b>Топ позиций в чеке</b>"])
        for item in items:
            title = escape(item.name)
            if len(title) > 72:
                title = f"{title[:72]}..."
            lines.append(f"• {title} — {_fmt_money_kopeks(item.sum)} ₽")

    return "\n".join(lines)


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


@router.message(Command("start"))
async def cmd_start(message: types.Message, user: User | None) -> None:
    if user is None:
        await message.answer(
            "🤖 <b>Бот подключен</b>\n\n"
            "⚠️ Ваш Telegram ID пока не привязан к аккаунту.\n"
            "🔗 Укажите Telegram ID в профиле на сайте и отправьте JSON-чек.",
            parse_mode="HTML",
        )
        return
    await message.answer(
        "✅ <b>Бот готов</b>\n\n"
        "Принимаю JSON-файлы чеков.\n"
        "📎 Отправьте файл <code>.json</code> в чат.\n"
        "📋 Команды: <code>/last</code>, <code>/stats</code>, <code>/top</code>, <code>/shops</code>.",
        parse_mode="HTML",
    )


@router.message(Command("id"))
async def cmd_id(message: types.Message) -> None:
    telegram_id = message.from_user.id if message.from_user else "unknown"
    await message.answer(
        "🆔 <b>Ваш Telegram ID</b>\n"
        f"<pre>{telegram_id}</pre>\n"
        "Скопируйте его в профиль на сайте для привязки.",
        parse_mode="HTML",
    )


@router.message(Command("last"))
async def cmd_last(message: types.Message, db: Session, user: User | None) -> None:
    if await _throttle_message(message, key="last", seconds=2):
        return
    if user is None:
        await message.answer(
            "❌ Telegram ID не привязан.\n"
            "⚠️ Сначала укажите Telegram ID в профиле на сайте.",
            parse_mode="HTML",
        )
        return

    receipts = db.exec(
        select(Receipt)
        .where(Receipt.owner_id == user.id)
        .order_by(col(Receipt.date_time).desc())
        .limit(5)
    ).all()
    if not receipts:
        await message.answer("📭 У вас пока нет загруженных чеков.")
        return

    logger.info(
        "bot_cmd_last user_id=%s tg_id=%s",
        user.id,
        message.from_user.id if message.from_user else None,
    )
    await message.answer(
        _build_last_text(db, user, receipts),
        parse_mode="HTML",
        reply_markup=_build_last_keyboard(receipts),
    )


@router.message(Command("stats"))
async def cmd_stats(message: types.Message, db: Session, user: User | None) -> None:
    if await _throttle_message(message, key="stats", seconds=2):
        return
    if user is None:
        await message.answer(
            "❌ Telegram ID не привязан.\n"
            "⚠️ Сначала укажите Telegram ID в профиле на сайте.",
            parse_mode="HTML",
        )
        return

    total_sum, receipts_count = db.exec(
        select(
            func.coalesce(func.sum(col(Receipt.total_sum)), 0),
            func.count(col(Receipt.id)),
        ).where(col(Receipt.owner_id) == user.id)
    ).one()
    avg = int(total_sum / receipts_count) if receipts_count else 0
    logger.info(
        "bot_cmd_stats user_id=%s tg_id=%s",
        user.id,
        message.from_user.id if message.from_user else None,
    )
    await message.answer(
        "<b>Статистика по чекам</b>\n\n"
        f"🧾 Чеков: <b>{int(receipts_count)}</b>\n"
        f"💰 Сумма: <b>{_fmt_money_kopeks(int(total_sum))} ₽</b>\n"
        f"📊 Средний чек: <b>{_fmt_money_kopeks(avg)} ₽</b>",
        parse_mode="HTML",
    )


@router.message(Command("top"))
async def cmd_top(message: types.Message, db: Session, user: User | None) -> None:
    if await _throttle_message(message, key="top", seconds=2):
        return
    if user is None:
        await message.answer(
            "❌ Telegram ID не привязан.\n"
            "⚠️ Сначала укажите Telegram ID в профиле на сайте.",
            parse_mode="HTML",
        )
        return

    rows = db.exec(
        select(
            col(ReceiptItem.name),
            func.coalesce(func.sum(col(ReceiptItem.sum)), 0).label("total"),
            func.count(col(ReceiptItem.id)).label("count"),
        )
        .join(Receipt, col(Receipt.id) == col(ReceiptItem.receipt_id))
        .where(col(Receipt.owner_id) == user.id)
        .group_by(col(ReceiptItem.name))
        .order_by(desc("total"))
        .limit(5)
    ).all()
    if not rows:
        await message.answer("📭 Пока нет данных по товарам.")
        return

    logger.info(
        "bot_cmd_top user_id=%s tg_id=%s",
        user.id,
        message.from_user.id if message.from_user else None,
    )
    lines = ["<b>Топ-5 товаров по сумме</b>", ""]
    for idx, (name, total, count) in enumerate(rows, start=1):
        title = escape(name)
        if len(title) > 56:
            title = f"{title[:56]}..."
        lines.append(
            f"{idx}. {title}\n"
            f"└ 💰 {_fmt_money_kopeks(int(total))} ₽ · позиций: {int(count)}"
        )
        if idx != len(rows):
            lines.append("────────────────")
    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(Command("shops"))
async def cmd_shops(message: types.Message, db: Session, user: User | None) -> None:
    if await _throttle_message(message, key="shops", seconds=2):
        return
    if user is None:
        await message.answer(
            "❌ Telegram ID не привязан.\n"
            "⚠️ Сначала укажите Telegram ID в профиле на сайте.",
            parse_mode="HTML",
        )
        return

    rows = db.exec(
        select(
            col(Shop.retail_name),
            col(Shop.address),
            func.coalesce(func.sum(col(Receipt.total_sum)), 0).label("total"),
            func.count(col(Receipt.id)).label("count"),
        )
        .join(Shop, col(Shop.id) == col(Receipt.shop_id))
        .where(col(Receipt.owner_id) == user.id)
        .group_by(col(Shop.retail_name), col(Shop.address))
        .order_by(desc("total"))
        .limit(5)
    ).all()
    if not rows:
        await message.answer("📭 Пока нет данных по магазинам.")
        return

    logger.info(
        "bot_cmd_shops user_id=%s tg_id=%s",
        user.id,
        message.from_user.id if message.from_user else None,
    )
    lines = ["<b>Топ-5 магазинов по сумме</b>", ""]
    for idx, (retail_name, address, total, count) in enumerate(rows, start=1):
        name = (retail_name or address or "Неизвестный магазин").strip()
        title = escape(name)
        if len(title) > 56:
            title = f"{title[:56]}..."
        lines.append(
            f"{idx}. 📍 {title}\n"
            f"└ 💰 {_fmt_money_kopeks(int(total))} ₽ · чеков: {int(count)}"
        )
        if idx != len(rows):
            lines.append("────────────────")
    await message.answer("\n".join(lines), parse_mode="HTML")


@router.callback_query(F.data == "last:refresh")
async def callback_last_refresh(
    callback: types.CallbackQuery, db: Session, user: User | None
) -> None:
    if await _throttle_callback(callback, key="last_refresh", seconds=1):
        return
    if user is None:
        await callback.answer("Аккаунт не привязан", show_alert=True)
        return

    receipts = db.exec(
        select(Receipt)
        .where(Receipt.owner_id == user.id)
        .order_by(col(Receipt.date_time).desc())
        .limit(5)
    ).all()
    if not receipts:
        await callback.answer("Чеки не найдены", show_alert=False)
        return

    if isinstance(callback.message, types.Message):
        await callback.message.edit_text(
            _build_last_text(db, user, receipts),
            parse_mode="HTML",
            reply_markup=_build_last_keyboard(receipts),
        )
    await callback.answer("Обновлено")


@router.callback_query(F.data.startswith("rcpt:"))
async def callback_receipt_details(
    callback: types.CallbackQuery, db: Session, user: User | None
) -> None:
    if await _throttle_callback(callback, key="receipt_details", seconds=1):
        return
    if user is None:
        await callback.answer("Аккаунт не привязан", show_alert=True)
        return

    payload = callback.data or ""
    receipt_id_raw = payload.split(":", maxsplit=1)[-1]
    try:
        receipt_id = uuid.UUID(receipt_id_raw)
    except ValueError:
        await callback.answer("Некорректный ID чека", show_alert=True)
        return

    receipt = db.exec(
        select(Receipt).where(
            col(Receipt.id) == receipt_id,
            col(Receipt.owner_id) == user.id,
        )
    ).first()
    if receipt is None:
        await callback.answer("Чек не найден", show_alert=True)
        return

    keyboard = types.InlineKeyboardMarkup(
        inline_keyboard=[
            [
                types.InlineKeyboardButton(
                    text="⬅️ К списку", callback_data="last:refresh"
                )
            ]
        ]
    )
    if isinstance(callback.message, types.Message):
        await callback.message.edit_text(
            _build_receipt_details_text(db, receipt),
            parse_mode="HTML",
            reply_markup=keyboard,
        )
    await callback.answer()


@router.message(F.document.file_name.endswith(".json"))
async def handle_receipt_json(
    message: types.Message,
    bot: Bot,
    db: Session,
    user: User | None,
) -> None:
    if await _throttle_message(message, key="upload_json", seconds=3):
        return
    if user is None:
        await message.answer(
            "❌ Вы не привязаны к аккаунту.\n"
            "⚠️ Добавьте Telegram ID в профиле на сайте, затем отправьте файл снова.",
            parse_mode="HTML",
        )
        return

    document = message.document
    if document is None:
        await message.answer("⚠️ Не удалось получить файл. Повторите отправку.")
        return

    await bot.send_chat_action(message.chat.id, "upload_document")

    try:
        file_info = await bot.get_file(document.file_id)
        if file_info.file_path is None:
            await message.answer("⚠️ Не удалось получить файл. Повторите отправку.")
            return
        file_content = await bot.download_file(file_info.file_path)
        if file_content is None:
            await message.answer("⚠️ Не удалось скачать файл. Повторите отправку.")
            return
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

        logger.info(
            "bot_receipt_import_ok user_id=%s tg_id=%s receipt_id=%s items=%s",
            user.id,
            message.from_user.id if message.from_user else None,
            receipt.id,
            len(created.items),
        )
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
        await message.answer("❌ Файл не является валидным JSON.")
    except HTTPException as exc:
        await message.answer(
            "❌ Не удалось обработать чек.\n"
            f"Причина: <code>{_safe_detail(exc.detail)}</code>",
            parse_mode="HTML",
        )
    except ValueError as exc:
        await message.answer(
            f"❌ Не удалось обработать чек.\nПричина: <code>{escape(str(exc))}</code>",
            parse_mode="HTML",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("bot_receipt_import_failed err=%s", exc)
        await message.answer(
            "❌ Внутренняя ошибка при обработке чека.\n"
            "Попробуйте еще раз немного позже."
        )


@router.message(F.document)
async def handle_wrong_file_type(message: types.Message) -> None:
    await message.answer(
        "⚠️ Поддерживаются только файлы <code>.json</code>.",
        parse_mode="HTML",
    )
