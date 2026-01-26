import { useState, useEffect, useCallback } from "react";
import { receiptsAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useReceipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReceipts = useCallback(async (skip = 0, limit = 100) => {
    setLoading(true);
    setError(null);

    try {
      const response = await receiptsAPI.getReceipts(skip, limit);
      const receiptsData = response.data || [];

      // Форматируем данные чеков
      const formattedReceipts = receiptsData.map((receipt) => ({
        ...receipt,
        total_sum_rub: kopecksToRubles(receipt.total_sum),
        cash_total_sum_rub: kopecksToRubles(receipt.cash_total_sum),
        ecash_total_sum_rub: kopecksToRubles(receipt.ecash_total_sum),
        shop_name: receipt.shop?.retail_name || "Неизвестный магазин",
        shop_legal_name: receipt.shop?.legal_name || "",
        cashier_name: receipt.cashier?.name || "Не указан",
        items_count: receipt.items?.length || 0,
        // Форматируем товары
        formatted_items:
          receipt.items?.map((item) => ({
            ...item,
            price_rub: kopecksToRubles(item.price),
            sum_rub: kopecksToRubles(item.sum),
          })) || [],
      }));

      setReceipts(formattedReceipts);
    } catch (err) {
      console.error("Error fetching receipts:", err);
      setError("Не удалось загрузить чеки");
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadReceipt = async (file) => {
    setUploading(true);
    setError(null);

    try {
      await receiptsAPI.uploadReceipt(file);
      await fetchReceipts(); // Обновляем список после загрузки
      return { success: true };
    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage =
        err.response?.data?.detail || "Ошибка при загрузке файла";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setUploading(false);
    }
  };

  const createReceipt = async (receiptData) => {
    try {
      await receiptsAPI.createReceipt(receiptData);
      await fetchReceipts();
      return { success: true };
    } catch (err) {
      console.error("Create receipt error:", err);
      const errorMessage =
        err.response?.data?.detail || "Ошибка при создании чека";
      return { success: false, error: errorMessage };
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return {
    receipts,
    loading,
    uploading,
    error,
    fetchReceipts,
    uploadReceipt,
    createReceipt,
  };
};
