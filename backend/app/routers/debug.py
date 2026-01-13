from fastapi import APIRouter, UploadFile, File, HTTPException
import json

router = APIRouter(prefix="/debug", tags=["debug"])


@router.post("/inspect-json")
async def inspect_json_file(file: UploadFile = File(...)):
    """Инспектирование JSON файла для отладки"""
    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))

        def analyze_structure(obj, path=""):
            result = {}
            if isinstance(obj, dict):
                for key, value in obj.items():
                    new_path = f"{path}.{key}" if path else key
                    if isinstance(value, (dict, list)):
                        result[new_path] = analyze_structure(value, new_path)
                    else:
                        result[new_path] = {
                            "type": type(value).__name__,
                            "value": str(value)[:100] if value else None
                        }
            elif isinstance(obj, list) and obj:
                # Анализируем первый элемент
                result[f"{path}[0]"] = analyze_structure(obj[0], f"{path}[0]")
            return result

        analysis = analyze_structure(data)

        # Ищем товары в структуре
        def find_items(obj, path=""):
            items = []
            if isinstance(obj, dict):
                if "items" in obj:
                    items.append({
                        "path": f"{path}.items" if path else "items",
                        "sample": obj["items"][0] if obj["items"] else None
                    })
                for key, value in obj.items():
                    new_path = f"{path}.{key}" if path else key
                    items.extend(find_items(value, new_path))
            elif isinstance(obj, list) and obj:
                items.extend(find_items(obj[0], f"{path}[0]"))
            return items

        item_locations = find_items(data)

        return {
            "format": "array" if isinstance(data, list) else "object",
            "length": len(data) if isinstance(data, list) else None,
            "keys": list(data.keys()) if isinstance(data, dict) else None,
            "item_locations": item_locations,
            "sample_item": item_locations[0]["sample"] if item_locations else None,
            "structure_preview": analysis
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error analyzing file: {str(e)}")