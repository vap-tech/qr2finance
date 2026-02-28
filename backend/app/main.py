from contextlib import asynccontextmanager
from enum import Enum

from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.bot.webhook import init_bot_webhook, shutdown_bot_webhook
from app.core.config import settings


def custom_generate_unique_id(route: APIRoute) -> str:
    raw_tag = route.tags[0] if route.tags else "default"
    tag = raw_tag.value if isinstance(raw_tag, Enum) else str(raw_tag)
    safe_tag = tag.replace("-", "_")
    safe_name = route.name.replace("-", "_")
    return f"{safe_tag}_{safe_name}"


docs_url = None
redoc_url = None
if settings.ENVIRONMENT == "local":
    docs_url = f"{settings.API_V1_STR}/docs"
    redoc_url = f"{settings.API_V1_STR}/redoc"


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_bot_webhook()
    try:
        yield
    finally:
        await shutdown_bot_webhook()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=docs_url,
    redoc_url=redoc_url,
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)
