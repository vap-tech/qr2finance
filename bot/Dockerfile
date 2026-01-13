# bot/Dockerfile
FROM python:3.11-alpine
LABEL authors="v.petrenko"

# Устанавливаем системные зависимости (если нужны)
RUN apk add --no-cache gcc musl-dev

# Создаем непривилегированного пользователя
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Копируем зависимости первыми (кеширующий слой)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем исходный код
COPY src/ ./src/

# Меняем владельца файлов
RUN chown -R appuser:appgroup /app

# Переключаемся на непривилегированного пользователя
USER appuser

# Запускаем бота
CMD ["python", "-m", "src.bot"]