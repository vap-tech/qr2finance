from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import json
from typing import List
from .. import crud, schemas, crud_stores
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User

router = APIRouter(prefix="/receipts", tags=["receipts"])

@router.get("/", response_model=List[schemas.Receipt])
def read_receipts(
        skip: int = 0,
        limit: int = 100,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    receipts = crud.get_user_receipts(db, user_id=current_user.user_id, skip=skip, limit=limit)
    return receipts


@router.post("/", response_model=schemas.Receipt)
def create_receipt(
        receipt: schemas.ReceiptCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    # Если store_id не указан, пытаемся определить автоматически
    if not receipt.store_id and receipt.retail_place:
        store_id = crud_stores.find_store_for_receipt(
            db,
            user_id=current_user.user_id,
            retail_place=receipt.retail_place,
            retail_place_address=receipt.retail_place_address
        )
        if store_id:
            receipt.store_id = store_id
    return crud.create_receipt(db=db, receipt=receipt, user_id=current_user.user_id)


@router.post("/upload-json")
async def upload_json_file(
        file: UploadFile = File(...),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        receipt_data = json.loads(content.decode('utf-8'))

        # Поддержка разных форматов JSON
        if isinstance(receipt_data, list) and len(receipt_data) > 0:
            # Формат с массивом
            if "ticket" in receipt_data[0]:
                ticket_data = receipt_data[0]["ticket"]["document"]["receipt"]
            else:
                # Прямой формат чека
                ticket_data = receipt_data[0]
        elif isinstance(receipt_data, dict):
            # Прямой объект чека
            if "ticket" in receipt_data:
                ticket_data = receipt_data["ticket"]["document"]["receipt"]
            elif "document" in receipt_data:
                ticket_data = receipt_data["document"]["receipt"]
            else:
                ticket_data = receipt_data
        else:
            raise HTTPException(status_code=400, detail="Unsupported JSON format")

        # Создаем список товаров с обработкой ошибок
        items = []
        for item in ticket_data.get("items", []):
            try:
                # Обработка productCodeData
                product_code_data = item.get("productCodeData")
                gtin = None
                serial_number = None
                product_id_type = None
                raw_product_code = None

                if isinstance(product_code_data, dict):
                    gtin = product_code_data.get("gtin")
                    serial_number = product_code_data.get("sernum")
                    product_id_type = product_code_data.get("productIdType")
                    raw_product_code = product_code_data.get("rawProductCode")
                elif product_code_data and isinstance(product_code_data, str):
                    raw_product_code = product_code_data

                # Проверяем наличие ошибки в productCodeDataError
                if item.get("productCodeDataError"):
                    print(f"Product code error for {item.get('name')}: {item.get('productCodeDataError')}")

                item_data = {
                    "name": item.get("name", "Без названия"),
                    "price": item.get("price", 0),
                    "quantity": item.get("quantity", 1),
                    "sum": item.get("sum", 0),
                    "nds": item.get("nds"),
                    "product_type": item.get("productType"),
                    "payment_type": item.get("paymentType", 4),
                    "gtin": gtin,
                    "product_id_type": product_id_type,
                    "serial_number": serial_number,
                    "raw_product_code": raw_product_code,
                }

                items.append(schemas.ReceiptItemCreate(**item_data))

            except Exception as e:
                print(f"Error processing item {item.get('name')}: {str(e)}")
                # Пропускаем проблемный товар, но продолжаем обработку остальных
                continue

        # Создаем объект чека
        receipt_create = schemas.ReceiptCreate(
            fiscal_drive_number=ticket_data.get("fiscalDriveNumber", ""),
            fiscal_document_number=ticket_data.get("fiscalDocumentNumber", 0),
            fiscal_sign=ticket_data.get("fiscalSign", 0),
            date_time=ticket_data.get("dateTime"),
            total_sum=ticket_data.get("totalSum", 0),
            cash_total_sum=ticket_data.get("cashTotalSum", 0),
            ecash_total_sum=ticket_data.get("ecashTotalSum", 0),
            credit_sum=ticket_data.get("creditSum", 0),
            prepaid_sum=ticket_data.get("prepaidSum", 0),
            provision_sum=ticket_data.get("provisionSum", 0),
            retail_place=ticket_data.get("retailPlace"),
            retail_place_address=ticket_data.get("retailPlaceAddress"),
            operator_name=ticket_data.get("operator"),
            operator_inn=ticket_data.get("operatorInn"),
            shift_number=ticket_data.get("shiftNumber"),
            kkt_reg_id=ticket_data.get("kktRegId"),
            fns_url=ticket_data.get("fnsUrl"),
            taxation_type=ticket_data.get("taxationType"),
            applied_taxation_type=ticket_data.get("appliedTaxationType"),
            nds10=ticket_data.get("nds10", 0),
            nds18=ticket_data.get("nds18", 0),
            user_org_name=ticket_data.get("user"),
            user_org_inn=ticket_data.get("userInn"),
            raw_data=ticket_data,
            items=items
        )

        receipt = crud.create_receipt(db=db, receipt=receipt_create, user_id=current_user.user_id)
        return {
            "message": "Receipt uploaded successfully",
            "receipt_id": receipt.receipt_id,
            "items_processed": len(items),
            "items_in_file": len(ticket_data.get("items", []))
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    except Exception as e:
        import traceback
        print(f"Error processing file: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")