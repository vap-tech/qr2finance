from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from .. import schemas
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/items", tags=["items"])

_BASE_ITEMS: List[dict] = [
    {
        "id": "item-001",
        "title": "Coffee beans",
        "description": "Ethiopian, light roast",
        "created_at": "2025-01-01T09:15:00Z",
    },
    {
        "id": "item-002",
        "title": "Notebook",
        "description": "A5 dotted pages",
        "created_at": "2025-01-05T12:30:00Z",
    },
    {
        "id": "item-003",
        "title": "USB-C cable",
        "description": "2m braided",
        "created_at": "2025-01-10T18:05:00Z",
    },
    {
        "id": "item-004",
        "title": "Vitamin D",
        "description": "2000 IU",
        "created_at": "2025-01-12T08:45:00Z",
    },
    {
        "id": "item-005",
        "title": "Desk lamp",
        "description": "Warm light, dimmable",
        "created_at": "2025-01-15T21:20:00Z",
    },
]

_ITEMS: List[dict] = list(_BASE_ITEMS)


def _to_item_public(item: dict, owner_id: str) -> schemas.ItemPublic:
    return schemas.ItemPublic(
        id=item["id"],
        title=item["title"],
        description=item.get("description"),
        owner_id=owner_id,
        created_at=item.get("created_at"),
    )


@router.get("/", response_model=schemas.ItemsPublic)
def read_items(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    total = len(_ITEMS)
    sliced = _ITEMS[skip : skip + limit]
    data = [_to_item_public(item, str(current_user.id)) for item in sliced]
    return schemas.ItemsPublic(data=data, count=total)


@router.post("/", response_model=schemas.ItemPublic)
def create_item(
    item: schemas.ItemCreate,
    current_user: User = Depends(get_current_user),
):
    new_item = {
        "id": f"item-{uuid4().hex[:8]}",
        "title": item.title,
        "description": item.description,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    _ITEMS.append(new_item)
    return _to_item_public(new_item, str(current_user.id))


@router.get("/{id}", response_model=schemas.ItemPublic)
def read_item(
    id: str,
    current_user: User = Depends(get_current_user),
):
    for item in _ITEMS:
        if item["id"] == id:
            return _to_item_public(item, str(current_user.id))
    raise HTTPException(status_code=404, detail="Item not found")


@router.put("/{id}", response_model=schemas.ItemPublic)
def update_item(
    id: str,
    item: schemas.ItemUpdate,
    current_user: User = Depends(get_current_user),
):
    for existing in _ITEMS:
        if existing["id"] == id:
            if item.title is not None:
                existing["title"] = item.title
            if item.description is not None:
                existing["description"] = item.description
            return _to_item_public(existing, str(current_user.id))
    raise HTTPException(status_code=404, detail="Item not found")


@router.delete("/{id}", response_model=schemas.Message)
def delete_item(
    id: str,
    current_user: User = Depends(get_current_user),
):
    for idx, existing in enumerate(_ITEMS):
        if existing["id"] == id:
            _ITEMS.pop(idx)
            return schemas.Message(message="Item deleted")
    raise HTTPException(status_code=404, detail="Item not found")
