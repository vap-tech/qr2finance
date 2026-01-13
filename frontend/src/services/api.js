import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Рекурсивно преобразуем Decimal объекты в числа
    const convertDecimals = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(convertDecimals);
      } else if (obj && typeof obj === 'object') {
        // Проверяем, является ли это Decimal объектом из Python
        if (obj.__Decimal__ !== undefined) {
          return parseFloat(obj.str) || 0;
        }

        // Обрабатываем обычные объекты
        const result = {};
        for (const key in obj) {
          result[key] = convertDecimals(obj[key]);
        }
        return result;
      }
      return obj;
    };

    if (response.data) {
      response.data = convertDecimals(response.data);
    }

    return response;
  },
  (error) => {
    // Обработка ошибок
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    // Если сервер недоступен
    if (!response) {
      console.error('Server is not available');
      return Promise.reject(new Error('Сервер недоступен. Попробуйте позже.'));
    }

    // Ошибка авторизации
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    // Ошибка валидации
    if (response.status === 422) {
      const errors = response.data.detail || 'Ошибка валидации';
      console.error('Validation error:', errors);
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
};

export const receiptsAPI = {
  getReceipts: (skip = 0, limit = 100) => api.get(`/receipts?skip=${skip}&limit=${limit}`),
  uploadReceipt: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/receipts/upload-json', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  createReceipt: (receiptData) => api.post('/receipts/', receiptData),
};

export const analyticsAPI = {
  getMonthlyStats: (params) => api.get('/analytics/monthly-stats', { params }),
  getTopProducts: (limit = 10) => api.get(`/analytics/top-products?limit=${limit}`),
  getStoreStats: () => api.get('/analytics/store-stats'),
};

export const storesAPI = {
  getStores: (skip = 0, limit = 100, favoriteOnly = false) => {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);
    if (favoriteOnly) params.append('favorite_only', 'true');

    return api.get(`/stores?${params.toString()}`);
  },

  getStoreStats: () => api.get('/stores/stats'),

  getStore: (storeId) => api.get(`/stores/${storeId}`),

  createStore: (storeData) => api.post('/stores/', storeData),

  updateStore: (storeId, storeData) => api.put(`/stores/${storeId}`, storeData),

  deleteStore: (storeId) => api.delete(`/stores/${storeId}`),

  createStorePattern: (storeId, patternData) => api.post(`/stores/${storeId}/patterns`, patternData),

  autoDetectStore: (retailPlace, address = null) => {
    const params = new URLSearchParams();
    params.append('retail_place', retailPlace);
    if (address) params.append('address', address);

    return api.get(`/stores/auto-detect?${params.toString()}`);
  },
};

export default api;