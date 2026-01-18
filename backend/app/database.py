import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool

load_dotenv()

# Для PostgreSQL: "postgresql://user:pass@localhost/dbname"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:225388@localhost/receipt_db")

# Параметры engine. 
# pool_pre_ping=True — проверяет живое ли соединение перед запросом (полезно для продакшена)
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True
)

# Настройка фабрики сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Современный способ объявления Base в SQLAlchemy 2.0
class Base(DeclarativeBase):
    pass

# Зависимость для FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
