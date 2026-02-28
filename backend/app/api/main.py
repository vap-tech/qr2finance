from fastapi import APIRouter

from app.api.routes import (
    analytics,
    cashiers,
    items,
    login,
    private,
    receipt_item_categories,
    receipt_items,
    receipts,
    shop,
    shop_categories,
    shop_owners,
    users,
    utils,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(analytics.router)
api_router.include_router(receipt_items.router)
api_router.include_router(receipt_item_categories.router)
api_router.include_router(shop_categories.router)
api_router.include_router(cashiers.router)
api_router.include_router(shop_owners.router)
api_router.include_router(shop.router)
api_router.include_router(receipts.router)
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
