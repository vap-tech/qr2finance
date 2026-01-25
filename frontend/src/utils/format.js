/* Утилиты для форматирования данных из API */

export const kopecksToRubles = (kopecks) => {
  if (kopecks === null || kopecks === undefined) return 0;
  return Number(kopecks) / 100;
};

export const formatDate = (dateString) => {
  if (!dateString) return "Нет даты";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Некорректная дата";
  }
};

export const formatMonth = (monthData) => {
  if (!monthData) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  }

  if (typeof monthData === "string") {
    if (monthData.includes("-")) {
      const [year, month] = monthData.split("-");
      return `${month}.${year}`;
    }
    return monthData;
  }

  return "текущий месяц";
};

export const calculatePercentages = (total, part) => {
  if (total <= 0) return 0;
  return (part / total) * 100;
};

export const formatCurrency = (value, decimals = 2) => {
  return value.toFixed(decimals);
};

export const formatStoreStats = (stats) => {
  return stats.map((store) => ({
    ...store,
    total_spent_rub: kopecksToRubles(store.total_amount),
    avg_receipt_rub: kopecksToRubles(store.receipt_avg),
  }));
};

export const safeNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
};
