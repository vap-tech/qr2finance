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
      month: "текущий месяц",
    },
    recentReceipts: [],
    loading: true,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      // Используем total-sums для общей статистики и monthly-dynamics для месячной
      const [totalSumsRes, monthlyStatsRes, receiptsRes] =
        await Promise.allSettled([
          analyticsAPI.getTotalSums(),
          analyticsAPI.getMonthlyDynamics(new Date().getFullYear()),
          receiptsAPI.getReceipts(0, 50),
        ]);

      const totalSums =
        totalSumsRes.status === "fulfilled" ? totalSumsRes.value?.data : null;
      const monthlyStats =
        monthlyStatsRes.status === "fulfilled"
          ? monthlyStatsRes.value?.data
          : null;
      const receipts =
        receiptsRes.status === "fulfilled" ? receiptsRes.value?.data : [];

      console.log("Dashboard - Total sums:", totalSums);
      console.log("Dashboard - Monthly stats:", monthlyStats);

      // Обрабатываем общую статистику
      let processedStats = {
        receipts_count: totalSums?.receipts_count || 0,
        total_sum_rub: kopecksToRubles(totalSums?.total_sum || 0),
        cash_sum_rub: kopecksToRubles(totalSums?.cash_total_sum || 0),
        ecash_sum_rub: kopecksToRubles(totalSums?.ecash_total_sum || 0),
        month: "все время",
      };

      // Если хотим показывать статистику за текущий месяц, а не общую
      if (monthlyStats && Array.isArray(monthlyStats)) {
        const currentMonth = new Date().getMonth() + 1;
        const currentMonthData = monthlyStats.find(
          (item) => item.month === currentMonth,
        );

        if (currentMonthData) {
          processedStats = {
            receipts_count: currentMonthData.receipts_count || 0,
            total_sum_rub: kopecksToRubles(currentMonthData.total_sum || 0),
            cash_sum_rub: kopecksToRubles(currentMonthData.cash_total_sum || 0),
            ecash_sum_rub: kopecksToRubles(
              currentMonthData.ecash_total_sum || 0,
            ),
            month: `${new Date().getFullYear()}-${String(currentMonth).padStart(2, "0")}`,
          };
        }
      }

      setData((prev) => ({
        ...prev,
        stats: processedStats,
      }));

      // Обрабатываем чеки
      const formattedReceipts = Array.isArray(receipts)
        ? receipts.map((receipt) => ({
            ...receipt,
            total_sum_rub: kopecksToRubles(receipt.total_sum || 0),
            cash_total_sum: kopecksToRubles(receipt.cash_total_sum || 0),
            shop_name: receipt.shop?.retail_name || "Неизвестный магазин",
            shop_chain: receipt.shop?.legal_name || "",
            cashier_name: receipt.cashier?.name || "",
            items_count: receipt.items?.length || 0,
            date_time: receipt.date_time || new Date().toISOString(),
            id: receipt.id || receipt.external_id || Math.random().toString(),
          }))
        : [];

      setData((prev) => ({
        ...prev,
        recentReceipts: formattedReceipts,
        loading: false,
      }));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setData({
        stats: {
          receipts_count: 0,
          total_sum_rub: 0,
          cash_sum_rub: 0,
          ecash_sum_rub: 0,
          month: "текущий месяц",
        },
        recentReceipts: [],
        loading: false,
      });
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
