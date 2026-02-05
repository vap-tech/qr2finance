import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import analytics, auth, items, receipts, stores, users

load_dotenv()
api_url = os.getenv("API_URL", "")
cors = os.getenv("CORS", "http://localhost:3000")
is_prod = os.getenv("IS_PROD") == "true"

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Receipt Analyzer API",
    description="API for analyzing shopping receipts",
    version="1.0.0",
    root_path=api_url,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[cors],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(auth.login_router)
app.include_router(receipts.router)
app.include_router(analytics.router)
app.include_router(stores.router)
app.include_router(users.router)
app.include_router(items.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to Receipt Analyzer API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
