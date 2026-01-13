/**
 * Утилиты для форматирования данных из API
 */

/**
 * Конвертирует значение в число, обрабатывая Decimal объекты
 */
export const toNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  // Если это Decimal объект из Python
  if (value && typeof value === 'object' && '__Decimal__' in value) {
    return parseFloat(value.str) || 0;
  }

  // Если это строка
  if (typeof value === 'string') {
    return parseFloat(value) || 0;
  }

  // Если это число
  if (typeof value === 'number') {
    return value;
  }

  // Пробуем конвертировать
  try {
    return parseFloat(value) || 0;
  } catch {
    return 0;
  }
};

/**
 * Форматирует сумму в рубли
 */
export const formatRubles = (value) => {
  const num = toNumber(value);
  return `${num.toFixed(2)} ₽`;
};

/**
 * Конвертирует копейки в рубли
 */
export const kopecksToRubles = (value) => {
  const num = toNumber(value);
  // Если число большое (вероятно копейки), делим на 100
  if (num > 1000) {
    return num / 100;
  }
  return num;
};

/**
 * Безопасный toFixed
 */
export const safeToFixed = (value, decimals = 2) => {
  const num = toNumber(value);
  return num.toFixed(decimals);
};