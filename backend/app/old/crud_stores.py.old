from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional, Dict, Any
import re
from . import models, schemas


# Автоматическое определение магазина по чеку
def find_store_for_receipt(db: Session, user_id: int, retail_place: str, retail_place_address: str = None) -> Optional[
    int]:
    """
    Находит магазин для чека на основе паттернов
    """
    if not retail_place:
        return None

    # 1. Ищем точное совпадение по названию и адресу
    query = db.query(models.Store).filter(models.Store.user_id == user_id)

    if retail_place_address:
        exact_match = query.filter(
            func.lower(models.Store.name) == func.lower(retail_place),
            func.lower(models.Store.address) == func.lower(retail_place_address)
        ).first()
        if exact_match:
            return exact_match.store_id

    # 2. Ищем по паттернам
    patterns = db.query(models.StorePattern) \
        .join(models.Store, models.StorePattern.store_id == models.Store.store_id) \
        .filter(models.Store.user_id == user_id) \
        .order_by(models.StorePattern.priority).all()

    for pattern in patterns:
        text_to_check = ""
        if pattern.pattern_type == 'name':
            text_to_check = retail_place.lower()
        elif pattern.pattern_type == 'address' and retail_place_address:
            text_to_check = retail_place_address.lower()
        elif pattern.pattern_type == 'both':
            text_to_check = f"{retail_place} {retail_place_address or ''}".lower()

        if not text_to_check:
            continue

        if pattern.is_regex:
            try:
                if re.search(pattern.pattern_value, text_to_check, re.IGNORECASE):
                    return pattern.store_id
            except re.error:
                continue
        else:
            if pattern.pattern_value.lower() in text_to_check:
                return pattern.store_id

    # 3. Ищем частичное совпадение по названию
    partial_match = query.filter(
        func.lower(models.Store.name).contains(func.lower(retail_place))
    ).first()

    if partial_match:
        return partial_match.store_id

    return None




