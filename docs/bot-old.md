# Старый Telegram-бот (legacy)

## Кратко
Старый бот реализован на `aiogram` и работал напрямую с БД через middleware, без HTTP-вызовов к API. Основная ценность: загрузка JSON-чека, просмотр последних чеков, базовая аналитика (`/stats`, `/top`, `/shops`).

Основные файлы:
- `backend/app/bot/handlers.py`
- `backend/app/bot/middleware.py`
- `backend/app/bot/run_bot.py` (polling)
- `backend/app/bot/main.upd.py` (webhook)
- `backend/app/services-old.py` (старые агрегаты для статистики)

## Что умел бот

### 1. Команды
- `/id`: вернуть Telegram ID пользователя.
- `/stats`: общая статистика по чекам пользователя.
- `/top`: топ-5 товаров по сумме трат.
- `/last`: последние 5 чеков с кратким превью.
- `/shops`: топ-5 магазинов по сумме трат.

Команды регистрировались в `run_bot.py` через `set_my_commands`.

### 2. Загрузка чека из JSON-файла
Сценарий `handle_receipt_json`:
1. Проверка, что Telegram-пользователь привязан к аккаунту (`user` найден middleware).
2. Приём документа `.json`.
3. Загрузка файла из Telegram (`get_file` + `download_file`).
4. `json.load` из буфера.
5. Если в файле массив, брался первый элемент.
6. Вызов `crud.create_receipt_with_backup(..., import_method="telegram_bot")`.
7. Ответ пользователю с ID чека и количеством позиций.

Если файл не JSON, срабатывал отдельный handler `handle_wrong_file_type`.

### 3. Инлайн-навигация и callback'и
Бот поддерживал callback-экраны:
- `more_receipts`: следующая страница чеков (фиксированный `offset=5`).
- `receipt_detail_<id>`: детальный экран чека (магазин, кассир, НДС, товары, фискальные поля).
- `raw_data_<id>`: предпросмотр сырых данных (`ReceiptRawBackup.raw_json`) с обрезкой.
- `stats`, `shops`, `last_receipts`: быстрые переходы по экранам.

### 4. Аналитика через `services-old.py`
Использовались функции:
- `get_user_total_sum` — агрегаты по суммам/количеству чеков.
- `get_top_products` — топ товаров по тратам.
- `get_spending_by_retail_shops` — агрегаты по магазинам.

Также были дополнительные функции (для API legacy), которые бот напрямую не вызывал:
- `get_monthly_dynamics`
- `get_total_retail_shops_count`
- `get_top_products_by_period`

## Как было реализовано

### 1. Доступ к БД
`DbSessionMiddleware` открывал DB-сессию на каждый апдейт:
- создавал `SessionLocal()`;
- искал `User` по `telegram_id == from_user.id`;
- прокидывал в handler `db` и `user`.

То есть бизнес-логика в хэндлерах работала с ORM напрямую.

### 2. Режимы запуска
Поддерживались два режима:
- Polling (`run_bot.py`): отдельный процесс `dp.start_polling(...)`.
- Webhook (`main.upd.py`): FastAPI endpoint `/bot/{TOKEN}` + проверка `X-Telegram-Bot-Api-Secret-Token`.

### 3. Модель взаимодействия
- Бот был state-less (без FSM/хранилища состояний).
- Формат ответов — Markdown-текст + inline keyboard.
- Ошибки в основном ловились broad `except Exception` с логированием.

## Ограничения и техдолг legacy-реализации

### 1. Жёсткая связанность с legacy-модулями
`handlers.py` завязан на:
- `app.services` (фактически `services-old.py`),
- `crud.create_receipt_with_backup` и `crud.get_recent_receipts` (из старого CRUD).

### 2. Несоответствие текущей модели данных
В callback'ах используется `int(callback.data.split(...))` для `receipt_id`, тогда как в текущей схеме ID — `uuid.UUID`.

### 3. Частично синхронный DB-доступ
Хэндлеры async, но работа с БД синхронная (через обычный Session), что блокирует event loop на тяжёлых запросах.

### 4. Пагинация «захардкожена»
`more_receipts` всегда использует `offset=5`, без передачи динамического оффсета в callback data.

### 5. Несколько мест с дублирующей логикой
`/stats` и callback `stats`, `/shops` и callback `shops` частично дублируют агрегаты/форматирование.

## Что полезно сохранить при переносе
- UX-поток «получил JSON -> обработал -> показал краткий результат».
- Команды `/stats`, `/top`, `/last`, `/shops` как минимально полезный набор.
- Экран деталей чека + просмотр сырого payload (с лимитом длины).
- Вебхук-режим с `secret_token` как прод-опция.

## Рекомендуемая стратегия миграции
1. Новый бот делает async HTTP-запросы к актуальным API-эндпоинтам (вместо прямого SQL в хэндлерах).
2. Для загрузки чеков использовать `POST /receipts/raw-json` или `POST /receipts/raw-file`.
3. Постепенно вернуть команды аналитики на базе текущих `/analytics/*` и `/receipts/*`.
4. После миграции удалить legacy-файлы бота и `services-old.py`.
