# Deploy: Backend + Frontend

Краткая инструкция по выкладке на текущий VPS (`www.space-flow.dev`, `systemd`, `nginx`).

## Текущая схема

- Репозиторий на сервере: `/root/qr2finance`
- Backend service: `qr2finance-backend.service`
- Backend порт: `127.0.0.1:8000`
- Nginx проксирует API: `/api/ -> 127.0.0.1:8000`
- Frontend root: `/var/www/qr2finance/frontend`

## Подключение

```bash
ssh -p 59152 root@www.space-flow.dev
```

## Backend deploy (одной командой)

На сервере уже есть скрипт:

```bash
qr2finance-deploy
```

Что делает:
1. `git pull --ff-only origin main` в `/root/qr2finance`
2. `systemctl restart qr2finance-backend.service`
3. ждёт `active`
4. проверяет health: `http://127.0.0.1:8000/api/v1/utils/health-check/`

Проверки вручную:

```bash
systemctl status qr2finance-backend.service
journalctl -u qr2finance-backend.service -f
curl -sS http://127.0.0.1:8000/api/v1/utils/health-check/
curl -ksS https://www.space-flow.dev/api/v1/utils/health-check/
```

## Frontend deploy (одной командой)

На сервере уже есть скрипт:

```bash
qr2finance-deploy-frontend
```

Что делает:
1. `git pull --ff-only origin main` в `/root/qr2finance`
2. `npm install` в `/root/qr2finance/frontend`
3. `npm run build`
4. полная очистка `/var/www/qr2finance/frontend`
5. копирование `frontend/dist/*` в `/var/www/qr2finance/frontend`
6. `nginx -t && systemctl reload nginx`
7. smoke-check главной страницы

Проверки вручную:

```bash
curl -ksSI https://www.space-flow.dev/
curl -ksS https://www.space-flow.dev/ | head -n 20
```

## Первичная подготовка сервера (если нужно заново)

### 1) Переменные окружения backend

Файл: `/root/qr2finance/.env`

Минимально обязательно:

```env
PROJECT_NAME=qr2finance
POSTGRES_SERVER=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=225388
POSTGRES_DB=receipt_db
FIRST_SUPERUSER=user@example.com
FIRST_SUPERUSER_PASSWORD=stringst
TELEGRAM_TOKEN=...
BOT_SECRET_TOKEN=...
DOMAIN=www.space-flow.dev
```

### 2) Инициализация данных

```bash
cd /root/qr2finance/backend
python3 -m app.initial_data
```

### 3) backend service

Unit:

```bash
/etc/systemd/system/qr2finance-backend.service
```

Управление:

```bash
systemctl daemon-reload
systemctl enable --now qr2finance-backend.service
systemctl restart qr2finance-backend.service
```

## Важные замечания

- Не деплой фронт в `/usr/share/nginx/html`: пакетные обновления `nginx` могут перезаписать `index.html`.
- Использовать только `/var/www/qr2finance/frontend`.
- После `pacman -Syu` проверять:
  - `systemctl status qr2finance-backend.service`
  - `nginx -t`
  - health backend и frontend.

## Быстрый чек-лист релиза

1. Локально: изменения в `main` запушены.
2. Сервер: `qr2finance-deploy`.
3. Сервер: `qr2finance-deploy-frontend`.
4. Проверка:
   - `https://www.space-flow.dev/`
   - `https://www.space-flow.dev/api/v1/utils/health-check/`
