import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';
import { api, setCachedAccessToken, requestTokenRefresh, getTokenExpiryTime, onSessionRevocation } from '../lib/api';
import { wipeUserDataOnLogout, getPendingOutboxOperations } from '../offline/userDataDb';
import { connectivity } from '../offline/connectivity';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReauthRequired: boolean;
  clearReauthWarning: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: (force?: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isReauthRequired, setIsReauthRequired] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('reauth_required') === 'true';
  });

  // Never block initial render: if session is active or cached user exists, render immediately
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const sessionActive = localStorage.getItem('session_active') === 'true';
    const saved = localStorage.getItem('user');
    if (sessionActive || saved) return false;
    return false;
  });

  const clearReauthWarning = useCallback(() => {
    setIsReauthRequired(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('reauth_required');
    }
  }, []);

  // Listen to revocation events for non-blocking re-authentication banner
  useEffect(() => {
    const unsubscribe = onSessionRevocation(isExplicit => {
      if (isExplicit) {
        setIsReauthRequired(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Check auth & background refresh on startup
  useEffect(() => {
    const checkAuth = async () => {
      const sessionActive = typeof localStorage !== 'undefined' && localStorage.getItem('session_active') === 'true';
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;

      if (!sessionActive && !saved) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {}
      }

      // If offline, render cached user directly without waiting
      if (!connectivity.isOnline()) {
        setIsLoading(false);
        return;
      }

      try {
        // Proactively refresh access token if needed, then fetch profile
        const token = localStorage.getItem('access_token');
        const exp = getTokenExpiryTime(token);
        if (!exp || exp - Date.now() < 5 * 60 * 1000) {
          await requestTokenRefresh();
        }

        const response = await api.get<User>('/auth/me');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
        localStorage.setItem('session_active', 'true');
      } catch {
        // Network error, 5xx, or offline: KEEP USER LOGGED IN!
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Proactive token refresh: refresh before expiry while app is open, and on focus / visibility return
  useEffect(() => {
    if (!user) return;

    const checkAndProactiveRefresh = async () => {
      if (!connectivity.isOnline()) return;
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
      const exp = getTokenExpiryTime(token);

      // Refresh if less than 5 minutes remaining or expired
      if (!exp || exp - Date.now() < 5 * 60 * 1000) {
        try {
          await requestTokenRefresh();
        } catch {}
      }
    };

    // Run interval check every 10 minutes
    const interval = setInterval(checkAndProactiveRefresh, 10 * 60 * 1000);

    // Run on app focus and visibility change
    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkAndProactiveRefresh();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [user]);

  // Outbox reconciliation on login and online events
  useEffect(() => {
    if (user?.id) {
      import('../offline/outboxSyncManager').then(({ outboxSyncManager }) => {
        outboxSyncManager.reconcileAndCleanup(user.id).catch(e => {
          console.warn('Startup sync & cleanup notice:', e);
        });
      });
    }

    const unsubscribe = connectivity.subscribe(online => {
      if (online && user?.id) {
        import('../offline/outboxSyncManager').then(({ outboxSyncManager }) => {
          outboxSyncManager.reconcileAndCleanup(user.id).catch(() => {});
        });
      }
    });
    return () => unsubscribe();
  }, [user?.id]);

  const handleAuthSuccess = (data: AuthResponse) => {
    setCachedAccessToken(data.accessToken);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('session_active', 'true');
      localStorage.removeItem('reauth_required');
    }
    setIsReauthRequired(false);

    const userInfo: User = {
      id: data.id,
      fullName: data.fullName,
      email: data.email,
      createdAt: new Date().toISOString(),
    };
    setUser(userInfo);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(userInfo));
    }
  };

  const login = async (payload: LoginPayload) => {
    const response = await api.post<AuthResponse>('/auth/login', payload);
    handleAuthSuccess(response.data);
  };

  const register = async (payload: RegisterPayload) => {
    const response = await api.post<AuthResponse>('/auth/register', payload);
    handleAuthSuccess(response.data);
  };

  const logout = async (force: boolean = false): Promise<boolean> => {
    if (user && !force) {
      const pending = await getPendingOutboxOperations(user.id);
      if (pending.length > 0) {
        const confirmed = window.confirm(
          'لديك تعديلات ومجموعات محفوظة محلياً ولم تتم مزامنتها مع الخادم بعد. هل أنت متأكد من تسجيل الخروج وحذف البيانات المحلية؟'
        );
        if (!confirmed) return false;
      }
    }

    try {
      if (connectivity.isOnline()) {
        const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refresh_token') : null;
        await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      if (user) {
        await wipeUserDataOnLogout(user.id);
      }
      setCachedAccessToken(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('session_active');
        localStorage.removeItem('reauth_required');
      }
      setUser(null);
      setIsReauthRequired(false);
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isReauthRequired,
        clearReauthWarning,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
