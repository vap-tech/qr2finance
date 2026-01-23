import { useState, useEffect, useCallback } from "react";
import { analyticsAPI, receiptsAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useDashboardData = () => {
  const [data, setData] = useState({
    stats: {
      receipts_count: 0,
      total_sum_rub: 0,
      cash_sum_rub: 0,
      ecash_sum_rub: 0,
      month: new Date().toISOString().slice(0, 7),
    },
    recentReceipts: [],
    loading: true,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [monthlyStatsRes, totalSumRes, receiptsRes] =
        await Promise.allSettled([
          analyticsAPI.getMonthlyDynamics(),
          analyticsAPI.getTotalSum(),
          receiptsAPI.getReceipts(0, 50),
        ]);

      const monthlyStats =
        monthlyStatsRes.status === "fulfilled"
          ? monthlyStatsRes.value?.data
          : null;
      const totalSum =
        totalSumRes.status === "fulfilled" ? totalSumRes.value?.data : null;
      const receipts =
        receiptsRes.status === "fulfilled" ? receiptsRes.value?.data : [];

      // Обработка статистики
      const processedStats = {
        receipts_count: totalSum?.receipts_count || 0,
        total_sum: totalSum?.total_sum || 0,
        total_sum_rub: kopecksToRubles(totalSum?.total_sum),
        cash_sum: totalSum?.cash_total_sum || 0,
        cash_sum_rub: kopecksToRubles(totalSum?.cash_total_sum),
        ecash_sum: totalSum?.ecash_total_sum || 0,
        ecash_sum_rub: kopecksToRubles(totalSum?.ecash_total_sum),
        month: new Date().toISOString().slice(0, 7),
      };

      // Обработка чеков
      const formattedReceipts = Array.isArray(receipts)
        ? receipts.map((receipt) => ({
            ...receipt,
            total_sum_rub: kopecksToRubles(receipt.total_sum),
            shop_name: receipt.shop?.retail_name || "Неизвестный магазин",
            shop_chain: receipt.shop?.legal_name || "",
            cashier_name: receipt.cashier?.name || "",
            items_count: receipt.items?.length || 0,
            date_time: receipt.date_time || new Date().toISOString(),
            id: receipt.id || receipt.external_id || Math.random().toString(),
          }))
        : [];

      setData({
        stats: processedStats,
        recentReceipts: formattedReceipts,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const refetch = () => {
    setData((prev) => ({ ...prev, loading: true }));
    fetchDashboardData();
  };

  return { ...data, refetch };
};
