import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { connectivity } from '../offline/connectivity';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let cachedAccessToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;

export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('access_token', token);
    else localStorage.removeItem('access_token');
  }
}

let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Zero network waiting / attempting when offline
    if (!connectivity.isOnline()) {
      return Promise.reject(new AxiosError('Network Offline', 'ERR_NETWORK', config));
    }
    const token = cachedAccessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

api.interceptors.response.use(
  response => {
    connectivity.recordRequestSuccess();
    return response;
  },
  async (error: AxiosError) => {
    connectivity.recordRequestFailure(error);
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (!connectivity.isOnline()) {
        // Offline: do not invalidate session or redirect to login
        return Promise.reject(error);
      }

      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/register') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        if (connectivity.isOnline()) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.message) return data.message;
    if (data?.errors) {
      const keys = Object.keys(data.errors);
      if (keys.length > 0 && data.errors[keys[0]].length > 0) {
        return data.errors[keys[0]][0];
      }
    }
    if (error.response?.status === 403) return 'غير مصرح لك بإجراء هذه العملية.';
    if (error.response?.status === 404) return 'العنصر المطلوب غير موجود.';
    if (error.response?.status === 401) return 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول.';
    if (error.message) return error.message;
  }
  return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
};

