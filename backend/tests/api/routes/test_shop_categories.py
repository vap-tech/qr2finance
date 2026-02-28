from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import random_email, random_lower_string


def test_recreate_deleted_category_reuses_same_id(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    name = f"cat-{random_lower_string()}"

    create_response = client.post(
        f"{settings.API_V1_STR}/shop-categories/",
        headers=normal_user_token_headers,
        json={"name": name},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    created_id = created["id"]
    assert created["name"] == name
    assert created["is_active"] is True

    delete_response = client.delete(
        f"{settings.API_V1_STR}/shop-categories/{created_id}",
        headers=normal_user_token_headers,
    )
    assert delete_response.status_code == 200
    deleted = delete_response.json()
    assert deleted["id"] == created_id
    assert deleted["is_active"] is False

    recreate_response = client.post(
        f"{settings.API_V1_STR}/shop-categories/",
        headers=normal_user_token_headers,
        json={"name": name},
    )
    assert recreate_response.status_code == 200
    recreated = recreate_response.json()
    assert recreated["id"] == created_id
    assert recreated["name"] == name
    assert recreated["is_active"] is True


def test_superuser_recreates_deleted_category_of_another_owner(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    other_user_headers = authentication_token_from_email(
        client=client,
        email=random_email(),
        db=db,
    )
    name = f"cat-{random_lower_string()}"

    create_response = client.post(
        f"{settings.API_V1_STR}/shop-categories/",
        headers=other_user_headers,
        json={"name": name},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    created_id = created["id"]

    delete_response = client.delete(
        f"{settings.API_V1_STR}/shop-categories/{created_id}",
        headers=other_user_headers,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["is_active"] is False

    recreate_by_superuser_response = client.post(
        f"{settings.API_V1_STR}/shop-categories/",
        headers=superuser_token_headers,
        json={"name": name},
    )
    assert recreate_by_superuser_response.status_code == 200
    recreated = recreate_by_superuser_response.json()
    assert recreated["id"] == created_id
    assert recreated["name"] == name
    assert recreated["is_active"] is True
