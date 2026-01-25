import { useState, useEffect } from "react";
import { analyticsAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useTotalSums = () => {
  const [totalSums, setTotalSums] = useState({
    total_sum: 0,
    total_sum_rub: 0,
    cash_sum: 0,
    cash_sum_rub: 0,
    ecash_sum: 0,
    ecash_sum_rub: 0,
    receipts_count: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchTotalSums = async () => {
      try {
        const response = await analyticsAPI.getTotalSums();
        const data = response.data || {};

        setTotalSums({
          total_sum: data.total_sum || 0,
          total_sum_rub: kopecksToRubles(data.total_sum),
          cash_sum: data.cash_total_sum || 0,
          cash_sum_rub: kopecksToRubles(data.cash_total_sum),
          ecash_sum: data.ecash_total_sum || 0,
          ecash_sum_rub: kopecksToRubles(data.ecash_total_sum),
          receipts_count: data.receipts_count || 0,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Error fetching total sums:", error);
        setTotalSums((prev) => ({
          ...prev,
          loading: false,
          error: "Не удалось загрузить общую статистику",
        }));
      }
    };

    fetchTotalSums();
  }, []);

  // Расчет процентов
  const percentages = {
    cash:
      totalSums.total_sum_rub > 0
        ? (totalSums.cash_sum_rub / totalSums.total_sum_rub) * 100
        : 0,
    ecash:
      totalSums.total_sum_rub > 0
        ? (totalSums.ecash_sum_rub / totalSums.total_sum_rub) * 100
        : 0,
  };

  return {
    ...totalSums,
    percentages,
  };
};
