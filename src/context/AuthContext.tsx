import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';
import { api, setCachedAccessToken } from '../lib/api';
import { wipeUserDataOnLogout, getPendingOutboxOperations } from '../offline/userDataDb';
import { connectivity } from '../offline/connectivity';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: (force?: boolean) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Never block initial render if user data is already cached in localStorage or no token exists
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const token = localStorage.getItem('access_token');
    const saved = localStorage.getItem('user');
    if (!token) return false;
    return !saved;
  });

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // If user exists in localStorage, render immediately and verify in background
      const saved = localStorage.getItem('user');
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {}
        setIsLoading(false);
      }

      if (!connectivity.isOnline()) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<User>('/auth/me');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch {
        // Interceptor handles refresh or 401; keep cached user on network failure
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

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
    localStorage.setItem('refresh_token', data.refreshToken);
    const userInfo: User = {
      id: data.id,
      fullName: data.fullName,
      email: data.email,
      createdAt: new Date().toISOString(),
    };
    setUser(userInfo);
    localStorage.setItem('user', JSON.stringify(userInfo));
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
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      if (user) {
        await wipeUserDataOnLogout(user.id);
      }
      setCachedAccessToken(null);
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      setUser(null);
    }
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
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

