import { OpenAPI } from "@/client";

export type ReceiptShopRead = {
  id: string;
  retail_name: string | null;
  address: string | null;
  is_favorite: boolean;
  notes: string | null;
  is_active: boolean;
};

export type ReceiptShort = {
  id: string;
  date_time: string;
  total_sum: number;
  cash_total_sum: number;
  ecash_total_sum: number;
  items_count: number;
  shop_display: string | null;
  shop: ReceiptShopRead | null;
};

export type ReceiptsShortPublic = {
  data: ReceiptShort[];
  count: number;
};

export type ReceiptItemInlineCreate = {
  name: string;
  price: number;
  quantity: number;
  sum: number;
  measure?: string | null;
  product_type?: number | null;
  gtin?: string | null;
  raw_product_code?: string | null;
};

const getToken = async () => {
  if (typeof OpenAPI.TOKEN === "function") {
    return (await OpenAPI.TOKEN({} as never)) || "";
  }
  return OpenAPI.TOKEN || "";
};

const parseErrorDetail = async (response: Response) => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    const detail = payload?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (
        typeof first === "object" &&
        first !== null &&
        "msg" in first &&
        typeof (first as { msg?: unknown }).msg === "string"
      ) {
        return (first as { msg: string }).msg;
      }
    }
  } catch {
    return "Request failed";
  }

  return "Request failed";
};

async function apiRequest<T>(input: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${OpenAPI.BASE}${input}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const readReceipts = async (params: {
  skip: number;
  limit: number;
  itemName?: string;
}): Promise<ReceiptsShortPublic> => {
  const search = new URLSearchParams({
    skip: String(params.skip),
    limit: String(params.limit),
  });
  if (params.itemName?.trim()) {
    search.set("item_name", params.itemName.trim());
  }

  return apiRequest<ReceiptsShortPublic>(
    `/api/v1/receipts/?${search.toString()}`,
  );
};

export const createReceiptFromRawJson = async (payload: unknown) => {
  return apiRequest<unknown>("/api/v1/receipts/raw-json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const createReceiptFromRawFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<unknown>("/api/v1/receipts/raw-file", {
    method: "POST",
    body: formData,
  });
};

export const deleteReceipt = async (id: string) => {
  return apiRequest<{ message: string }>(`/api/v1/receipts/${id}`, {
    method: "DELETE",
  });
};

export const addReceiptItems = async (
  id: string,
  items: ReceiptItemInlineCreate[],
) => {
  return apiRequest<unknown>(`/api/v1/receipts/${id}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(items),
  });
};
