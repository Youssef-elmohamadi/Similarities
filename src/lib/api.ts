import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { connectivity } from '../offline/connectivity';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let cachedAccessToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCachedAccessToken(token: string | null): void {
  cachedAccessToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem('access_token', token);
    else localStorage.removeItem('access_token');
  }
}

// Extract JWT expiration timestamp in milliseconds without external libs
export function getTokenExpiryTime(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Re-authentication callback registry (for non-blocking UI alert rather than hard redirect)
type SessionRevocationListener = (isExplicitlyRevoked: boolean) => void;
const revocationListeners = new Set<SessionRevocationListener>();

export function onSessionRevocation(listener: SessionRevocationListener): () => void {
  revocationListeners.add(listener);
  return () => revocationListeners.delete(listener);
}

function notifySessionRevocation(isExplicit: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('reauth_required', 'true');
  }
  revocationListeners.forEach(listener => {
    try {
      listener(isExplicit);
    } catch {}
  });
}

// BroadcastChannel for cross-tab token synchronization
const AUTH_BROADCAST_CHANNEL = 'quran_auth_sync_channel';
let authChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    authChannel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    authChannel.onmessage = (event: MessageEvent) => {
      const { type, accessToken, refreshToken } = event.data || {};
      if (type === 'TOKEN_REFRESH_SUCCESS' && accessToken) {
        cachedAccessToken = accessToken;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
          if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
          localStorage.removeItem('reauth_required');
        }
      } else if (type === 'SESSION_REVOKED') {
        notifySessionRevocation(true);
      }
    };
  } catch {}
}

// Single in-flight refresh promise across concurrent callers in the current tab
let inFlightRefreshPromise: Promise<string | null> | null = null;

async function executeRefreshHttp(): Promise<string | null> {
  const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refresh_token') : null;

  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      refreshToken ? { refreshToken } : {},
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data || {};
    if (accessToken) {
      setCachedAccessToken(accessToken);
      if (typeof localStorage !== 'undefined') {
        if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);
        localStorage.removeItem('reauth_required');
      }

      // Notify other open tabs
      if (authChannel) {
        authChannel.postMessage({
          type: 'TOKEN_REFRESH_SUCCESS',
          accessToken,
          refreshToken: newRefreshToken,
          timestamp: Date.now(),
        });
      }

      return accessToken;
    }
    return null;
  } catch (error: any) {
    const status = error.response?.status;
    const isExplicitAuthFailure = status === 401 || status === 403;

    if (isExplicitAuthFailure) {
      // Refresh token is truly revoked or expired by server
      notifySessionRevocation(true);
      if (authChannel) {
        authChannel.postMessage({ type: 'SESSION_REVOKED', timestamp: Date.now() });
      }
    } else {
      // Network error, 5xx, or offline: KEEP LOCAL SESSION INTACT!
      console.warn('Token refresh paused due to network or temporary server issue. Keeping local session.');
    }
    throw error;
  }
}

/**
 * Single shared refresh function coordinated across tabs and callers.
 */
export async function requestTokenRefresh(): Promise<string | null> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  // Cross-tab Web Locks coordinator (if supported by the browser)
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks?.request) {
    inFlightRefreshPromise = (async () => {
      return await navigator.locks.request('quran_auth_token_refresh_lock', async () => {
        // Check if another tab refreshed the token while this tab was waiting on the lock
        const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
        const exp = getTokenExpiryTime(currentToken);
        if (currentToken && exp && exp - Date.now() > 60000) {
          cachedAccessToken = currentToken;
          return currentToken;
        }
        return await executeRefreshHttp();
      });
    })().finally(() => {
      inFlightRefreshPromise = null;
    });
    return inFlightRefreshPromise;
  }

  // Fallback for environments without navigator.locks
  inFlightRefreshPromise = executeRefreshHttp().finally(() => {
    inFlightRefreshPromise = null;
  });
  return inFlightRefreshPromise;
}

// Request Interceptor: Attach bearer token, reject if strictly offline
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// Response Interceptor: 401 auto-retry via shared refresh coordinator
api.interceptors.response.use(
  response => {
    connectivity.recordRequestSuccess();
    return response;
  },
  async (error: AxiosError) => {
    connectivity.recordRequestFailure(error);
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Never loop or refresh if the request was already auth-related
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      // If offline, do NOT invalidate session or redirect
      if (!connectivity.isOnline()) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const newAccessToken = await requestTokenRefresh();
        if (newAccessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
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

if (typeof window !== 'undefined') {
  (window as any).__requestTokenRefresh = requestTokenRefresh;
}
