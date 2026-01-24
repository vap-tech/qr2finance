import { useState, useEffect, useCallback } from "react";
import { storesAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useStores = () => {
  const [stores, setStores] = useState([]);
  const [storeStats, setStoreStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [storesRes, statsRes] = await Promise.allSettled([
        storesAPI.getStores(),
        storesAPI.getStoreStats(),
      ]);

      // Обработка магазинов
      const storesData =
        storesRes.status === "fulfilled" ? storesRes.value?.data || [] : [];

      // Обработка статистики
      const statsData =
        statsRes.status === "fulfilled" ? statsRes.value?.data || [] : [];

      const formattedStats = statsData.map((store) => ({
        id: store.id,
        retail_name: store.retail_name || "Неизвестный магазин",
        legal_name: store.legal_name || "Неизвестно",
        total_spent_rub: kopecksToRubles(store.total_amount),
        receipts_count: store.receipts_count || 0,
        avg_receipt_rub: kopecksToRubles(store.receipt_avg),
        chain_name: store.chain_name || "",
        address: store.address || "",
      }));

      setStores(storesData);
      setStoreStats(formattedStats);
    } catch (err) {
      console.error("Error fetching stores:", err);
      setError("Не удалось загрузить данные магазинов");
      setStores([]);
      setStoreStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const createStore = async (storeData) => {
    try {
      await storesAPI.createStore(storeData);
      await fetchStores();
      return { success: true };
    } catch (error) {
      console.error("Create store error:", error);
      return {
        success: false,
        error: error.response?.data?.detail || "Не удалось создать магазин",
      };
    }
  };

  const updateStore = async (storeId, storeData) => {
    try {
      await storesAPI.updateStore(storeId, storeData);
      await fetchStores();
      return { success: true };
    } catch (error) {
      console.error("Update store error:", error);
      return {
        success: false,
        error: error.response?.data?.detail || "Не удалось обновить магазин",
      };
    }
  };

  const deleteStore = async (storeId) => {
    try {
      await storesAPI.deleteStore(storeId);
      await fetchStores();
      return { success: true };
    } catch (error) {
      console.error("Delete store error:", error);
      return {
        success: false,
        error: error.response?.data?.detail || "Не удалось удалить магазин",
      };
    }
  };

  return {
    stores,
    storeStats,
    loading,
    error,
    fetchStores,
    createStore,
    updateStore,
    deleteStore,
  };
};
