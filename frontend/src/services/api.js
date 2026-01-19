import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Единый интерцептор для токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Единый интерцептор для обработки ответов и ошибок
api.interceptors.response.use(
  (response) => {
    // В 2026 году бэкенд на SQLAlchemy 2.0 отдает чистые числа,
    // но на случай старых данных оставляем конвертацию Decimal
    const convertDecimals = (obj) => {
      if (Array.isArray(obj)) return obj.map(convertDecimals);
      if (obj && typeof obj === "object") {
        if (obj.__Decimal__ !== undefined) return parseFloat(obj.str) || 0;
        const result = {};
        for (const key in obj) result[key] = convertDecimals(obj[key]);
        return result;
      }
      return obj;
    };
    if (response.data) response.data = convertDecimals(response.data);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),
  login: (credentials) => api.post("/auth/login", credentials),
};

export const receiptsAPI = {
  getReceipts: (skip = 0, limit = 100) =>
    api.get("/receipts", { params: { skip, limit } }),
  uploadReceipt: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/receipts/upload-json", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  createReceipt: (receiptData) => api.post("/receipts/", receiptData),
};

export const analyticsAPI = {
  // Исправлено: поддержка фильтрации по году
  getMonthlyStats: (year = 2026) =>
    api.get("/analytics/monthly-dynamics", { params: { year } }),

  // Исправлено: поддержка месяцев (1, 3, 26...)
  getTopProducts: (months = 3, limit = 10) =>
    api.get("/analytics/top-products", { params: { months, limit } }),

  getStoreStats: () => api.get("/analytics/store-stats"),
};

export const storesAPI = {
  getStores: (skip = 0, limit = 100) =>
    api.get("/stores/", { params: { skip, limit } }),

  getStoreStats: () => api.get("/stores/stats"),

  createStore: (storeData) => api.post("/stores/", storeData),

  // Важно: на бэкенде нужно будет добавить эндпоинт для этого PUT
  updateStore: (storeId, storeData) => api.put(`/stores/${storeId}`, storeData),

  deleteStore: (storeId) => api.delete(`/stores/${storeId}`),
};

export default api;
