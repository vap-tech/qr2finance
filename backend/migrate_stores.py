#!/usr/bin/env python3
"""
Скрипт для добавления таблиц магазинов и колонки store_id
"""

import sys
import os
from pathlib import Path

# Добавляем путь к проекту
sys.path.insert(0, str(Path(__file__).parent))

from app.database import engine
from sqlalchemy import text, inspect


def check_table_exists(table_name):
    """Проверяет, существует ли таблица"""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()


def check_column_exists(table_name, column_name):
    """Проверяет, существует ли колонка"""
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)
    return any(col['name'] == column_name for col in columns)


def run_migration():
    print("🔄 Начинаем миграцию для добавления магазинов...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Создаем таблицу stores если её нет
            if not check_table_exists('stores'):
                print("  Создаем таблицу stores...")
                conn.execute(text("""
                                  CREATE TABLE stores
                                  (
                                      store_id    SERIAL PRIMARY KEY,
                                      user_id     INTEGER      NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
                                      name        VARCHAR(255) NOT NULL,
                                      chain_name  VARCHAR(255),
                                      address     TEXT,
                                      latitude    DECIMAL(10, 8),
                                      longitude   DECIMAL(11, 8),
                                      is_favorite BOOLEAN   DEFAULT FALSE,
                                      category    VARCHAR(50),
                                      notes       TEXT,
                                      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                                  )
                                  """))
                print("  ✅ Таблица stores создана")
            else:
                print("  ⏭️  Таблица stores уже существует")

            # 2. Создаем таблицу store_patterns если её нет
            if not check_table_exists('store_patterns'):
                print("  Создаем таблицу store_patterns...")
                conn.execute(text("""
                                  CREATE TABLE store_patterns
                                  (
                                      pattern_id    SERIAL PRIMARY KEY,
                                      user_id       INTEGER      NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
                                      pattern_type  VARCHAR(20)  NOT NULL,
                                      pattern_value VARCHAR(500) NOT NULL,
                                      store_id      INTEGER      NOT NULL REFERENCES stores (store_id) ON DELETE CASCADE,
                                      is_regex      BOOLEAN   DEFAULT FALSE,
                                      priority      INTEGER   DEFAULT 10,
                                      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                                  )
                                  """))
                print("  ✅ Таблица store_patterns создана")
            else:
                print("  ⏭️  Таблица store_patterns уже существует")

            # 3. Добавляем колонку store_id в receipts если её нет
            if not check_column_exists('receipts', 'store_id'):
                print("  Добавляем колонку store_id в таблицу receipts...")
                conn.execute(text("""
                                  ALTER TABLE receipts
                                      ADD COLUMN store_id INTEGER
                                  """))
                print("  ✅ Колонка store_id добавлена")

                # 4. Добавляем внешний ключ
                print("  Добавляем внешний ключ fk_receipts_store...")
                conn.execute(text("""
                                  ALTER TABLE receipts
                                      ADD CONSTRAINT fk_receipts_store
                                          FOREIGN KEY (store_id)
                                              REFERENCES stores (store_id)
                                              ON DELETE SET NULL
                                  """))
                print("  ✅ Внешний ключ добавлен")
            else:
                print("  ⏭️  Колонка store_id уже существует")

            # 5. Создаем индексы
            indexes = [
                ("idx_stores_user", "stores(user_id)"),
                ("idx_stores_chain", "stores(chain_name)"),
                ("idx_patterns_user", "store_patterns(user_id)"),
                ("idx_patterns_store", "store_patterns(store_id)"),
                ("idx_receipts_store", "receipts(store_id)"),
            ]

            for idx_name, idx_table in indexes:
                try:
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_table}"))
                    print(f"  ✅ Индекс {idx_name} создан")
                except Exception as e:
                    print(f"  ⚠️  Ошибка создания индекса {idx_name}: {e}")

            trans.commit()
            print("\n🎉 Миграция успешно завершена!")

            # Показываем статус
            print("\n📊 Статус после миграции:")
            print(f"  Таблица stores: {'✅ существует' if check_table_exists('stores') else '❌ отсутствует'}")
            print(
                f"  Таблица store_patterns: {'✅ существует' if check_table_exists('store_patterns') else '❌ отсутствует'}")
            print(
                f"  Колонка receipts.store_id: {'✅ существует' if check_column_exists('receipts', 'store_id') else '❌ отсутствует'}")

        except Exception as e:
            trans.rollback()
            print(f"\n❌ Ошибка миграции: {e}")
            import traceback
            traceback.print_exc()
            raise


def rollback_migration():
    """Откат миграции (опасно!)"""
    print("🔄 Начинаем откат миграции...")

    confirm = input("⚠️  ВНИМАНИЕ: Это удалит таблицы stores и store_patterns! Продолжить? (y/N): ")
    if confirm.lower() != 'y':
        print("Откат отменен")
        return

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Удаляем индексы
            indexes = [
                "idx_receipts_store",
                "idx_patterns_store",
                "idx_patterns_user",
                "idx_stores_chain",
                "idx_stores_user"
            ]

            for idx_name in indexes:
                try:
                    conn.execute(text(f"DROP INDEX IF EXISTS {idx_name}"))
                    print(f"  ✅ Индекс {idx_name} удален")
                except:
                    pass

            # Удаляем внешний ключ
            try:
                conn.execute(text("ALTER TABLE receipts DROP CONSTRAINT IF EXISTS fk_receipts_store"))
                print("  ✅ Внешний ключ удален")
            except:
                pass

            # Удаляем колонку store_id
            try:
                conn.execute(text("ALTER TABLE receipts DROP COLUMN IF EXISTS store_id"))
                print("  ✅ Колонка store_id удалена")
            except:
                pass

            # Удаляем таблицы
            try:
                conn.execute(text("DROP TABLE IF EXISTS store_patterns"))
                print("  ✅ Таблица store_patterns удалена")
            except:
                pass

            try:
                conn.execute(text("DROP TABLE IF EXISTS stores"))
                print("  ✅ Таблица stores удалена")
            except:
                pass

            trans.commit()
            print("\n✅ Откат миграции завершен!")

        except Exception as e:
            trans.rollback()
            print(f"\n❌ Ошибка отката: {e}")
            raise


if __name__ == "__main__":
    print("=" * 50)
    print("Миграция базы данных для магазинов")
    print("=" * 50)

    if len(sys.argv) < 2:
        print("\nИспользование:")
        print("  python migrate_stores.py up   - Применить миграцию")
        print("  python migrate_stores.py down - Откатить миграцию")
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "up":
        run_migration()
    elif command == "down":
        rollback_migration()
    else:
        print(f"Неизвестная команда: {command}")
        print("Используйте 'up' или 'down'")