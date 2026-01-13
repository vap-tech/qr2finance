from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, receipts, analytics, debug
from .database import engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Receipt Analyzer API",
    description="API for analyzing shopping receipts",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(receipts.router)
app.include_router(analytics.router)
app.include_router(debug.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Receipt Analyzer API"}