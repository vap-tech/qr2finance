import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from .. import crud, models, schemas, services
from ..database import get_db
# Предполагаем, что у вас есть зависимость для получения текущего юзера из JWT
from ..dependencies import get_current_user

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("/", response_model=schemas.Receipt)
def create_receipt(
        receipt_data: dict,  # Или schemas.ReceiptCreate если шлете плоский JSON
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Создание чека вручную через передачу JSON-тела запроса.
    """
    return crud.create_receipt_full(db, receipt_data, user_id=current_user.id)


@router.get("/", response_model=List[schemas.Receipt])
def read_receipts(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение списка чеков текущего пользователя с пагинацией.
    """
    receipts = crud.get_user_receipts(db, user_id=current_user.id, skip=skip, limit=limit)
    return receipts


@router.post("/upload-json")
async def upload_json_file(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Загрузка файла чека (JSON).
    Принимает файл, парсит его и сохраняет в базу.
    """
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are allowed")

    try:
        # Читаем содержимое файла
        contents = await file.read()
        data = json.loads(contents)

        # Если в файле список чеков (как в ваших примерах [{}])
        if isinstance(data, list):
            # Берем первый чек из списка для обработки (или можно сделать цикл)
            receipt_json = data[0]
        else:
            receipt_json = data

        # Вызываем ваш CRUD метод для сохранения
        receipt = crud.create_receipt_full(db, receipt_json, user_id=current_user.id)

        # Получаем данные для ответа
        ticket_data = receipt_json.get("ticket", {}).get("document", {}).get("receipt", {})

        return {
            "status": "success",
            "message": "Receipt uploaded successfully",
            "receipt_id": receipt.id,
            "external_id": receipt.external_id,
            "items_processed": len(receipt.items),
            "items_in_file": len(ticket_data.get("items", []))
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        # Логируем ошибку для отладки
        print(f"Error processing file: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing receipt: {str(e)}")
