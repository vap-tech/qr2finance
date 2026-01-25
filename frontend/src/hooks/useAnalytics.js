import { useState, useEffect, useCallback } from "react";
import { analyticsAPI } from "../services/api";
import { kopecksToRubles } from "../utils/format";

export const useAnalytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    monthly: [],
    categories: [],
    topProducts: [],
    loading: true,
    error: null,
  });

  const [year, setYear] = useState(new Date().getFullYear());
  const [monthsRange, setMonthsRange] = useState(6);

  const fetchAnalyticsData = useCallback(async () => {
    setAnalyticsData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [monthlyRes, topProductsRes] = await Promise.allSettled([
        analyticsAPI.getMonthlyDynamics(year),
        analyticsAPI.getTopProducts(monthsRange, 10),
      ]);

      // Обработка месячной динамики
      const monthlyData =
        monthlyRes.status === "fulfilled" ? monthlyRes.value?.data || [] : [];

      const formattedMonthly = monthlyData.map((item) => ({
        month: item.month || 0,
        monthName: getMonthName(item.month),
        totalAmount: kopecksToRubles(item.total_sum || 0),
        cashAmount: kopecksToRubles(item.cash_total_sum || 0),
        ecashAmount: kopecksToRubles(item.ecash_total_sum || 0),
        receiptsCount: item.receipts_count || 0,
        year: year,
      }));

      // Обработка топ товаров
      const topProductsData =
        topProductsRes.status === "fulfilled"
          ? topProductsRes.value?.data || []
          : [];

      const formattedProducts = topProductsData.map((product) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: product.name || "Без названия",
        totalAmount: kopecksToRubles(product.total_sum || 0),
        quantity: product.total_quantity || 0,
        measure: product.measure || "шт",
        category: product.category || "Не указано",
        fullName: product.name,
      }));

      setAnalyticsData({
        monthly: formattedMonthly,
        categories: [],
        topProducts: formattedProducts,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setAnalyticsData({
        monthly: [],
        categories: [],
        topProducts: [],
        loading: false,
        error: "Не удалось загрузить данные аналитики",
      });
    }
  }, [year, monthsRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const getMonthName = (monthNumber) => {
    const months = [
      "Янв",
      "Фев",
      "Мар",
      "Апр",
      "Май",
      "Июн",
      "Июл",
      "Авг",
      "Сен",
      "Окт",
      "Ноя",
      "Дек",
    ];
    return months[monthNumber - 1] || `М${monthNumber}`;
  };

  const getInsights = () => {
    if (analyticsData.monthly.length === 0) return [];

    const insights = [];
    const monthly = analyticsData.monthly;

    // Самый дорогой месяц
    const maxMonth = monthly.reduce(
      (max, item) => (item.totalAmount > max.totalAmount ? item : max),
      { totalAmount: 0, monthName: "" },
    );

    if (maxMonth.totalAmount > 0) {
      insights.push({
        type: "max",
        title: "Самый затратный месяц",
        value: `${maxMonth.monthName} ${maxMonth.year}`,
        amount: maxMonth.totalAmount,
      });
    }

    // Самый активный месяц по чекам
    if (monthly.some((item) => item.receiptsCount > 0)) {
      const activeMonth = monthly.reduce(
        (max, item) => (item.receiptsCount > max.receiptsCount ? item : max),
        { receiptsCount: 0, monthName: "" },
      );

      if (activeMonth.receiptsCount > 0) {
        insights.push({
          type: "activity",
          title: "Самый активный месяц",
          value: `${activeMonth.monthName} ${activeMonth.year}`,
          count: activeMonth.receiptsCount,
        });
      }
    }

    // Топ товар
    if (analyticsData.topProducts.length > 0) {
      const topProduct = analyticsData.topProducts[0];
      insights.push({
        type: "product",
        title: "Топовый товар",
        value: topProduct.name,
        amount: topProduct.totalAmount,
      });
    }

    // Общая статистика
    const totalSpent = monthly.reduce((sum, item) => sum + item.totalAmount, 0);
    const totalReceipts = monthly.reduce(
      (sum, item) => sum + item.receiptsCount,
      0,
    );

    insights.push({
      type: "total",
      title: "Всего за период",
      value: `${monthly.length} месяцев`,
      amount: totalSpent,
      count: totalReceipts,
    });

    return insights;
  };

  return {
    ...analyticsData,
    year,
    monthsRange,
    setYear,
    setMonthsRange,
    refetch: fetchAnalyticsData,
    getInsights,
  };
};
