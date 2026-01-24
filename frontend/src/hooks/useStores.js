import { useState, useEffect, useCallback } from "react";
import { storesAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useStores = () => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    sortBy: "total_amount",
    descending: true,
    skip: 0,
    limit: 100,
  });
  const [totalStores, setTotalStores] = useState(0);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await storesAPI.getStores({
        sort_by: sortConfig.sortBy,
        descending: sortConfig.descending,
        skip: sortConfig.skip,
        limit: sortConfig.limit,
      });

      const storesData = response.data || [];

      // Форматируем данные из API
      const formattedStores = storesData.map((store) => ({
        id: store.id,
        retail_name: store.retail_name || "Неизвестный магазин",
        legal_name: store.legal_name || "Неизвестно",
        total_amount: store.total_amount || 0,
        total_spent_rub: kopecksToRubles(store.total_amount),
        receipts_count: store.receipts_count || 0,
        receipt_avg: store.receipt_avg || 0,
        avg_receipt_rub: kopecksToRubles(store.receipt_avg),
        inn: store.inn || "",
        address: store.address || "",
        category: store.category || "",
        is_favorite: store.is_favorite || false,
        notes: store.notes || "",
      }));

      setStores(formattedStores);
      setTotalStores(formattedStores.length);
    } catch (err) {
      console.error("Error fetching stores:", err);
      setError("Не удалось загрузить данные магазинов");
      setStores([]);
      setTotalStores(0);
    } finally {
      setLoading(false);
    }
  }, [sortConfig]);

  const updateSortConfig = (newSortConfig) => {
    setSortConfig((prev) => ({
      ...prev,
      ...newSortConfig,
    }));
  };

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

  const toggleFavorite = async (storeId, isFavorite) => {
    try {
      await storesAPI.updateStore(storeId, { is_favorite: isFavorite });
      await fetchStores();
      return { success: true };
    } catch (error) {
      console.error("Toggle favorite error:", error);
      return {
        success: false,
        error: error.response?.data?.detail || "Не удалось обновить статус",
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
    loading,
    error,
    sortConfig,
    totalStores,
    fetchStores,
    updateSortConfig,
    createStore,
    updateStore,
    toggleFavorite,
    deleteStore,
  };
};
