import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse, LoginPayload, RegisterPayload } from '../types/auth';
import { api } from '../lib/api';
import { wipeUserDataOnLogout, getPendingOutboxOperations } from '../offline/userDataDb';

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
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        const saved = localStorage.getItem('user');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {}
        }
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<User>('/auth/me');
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      } catch {
        // Interceptor handles refresh or clear
        const saved = localStorage.getItem('user');
        if (saved && typeof window !== 'undefined' && !window.navigator.onLine) {
          try {
            setUser(JSON.parse(saved));
          } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = (data: AuthResponse) => {
    localStorage.setItem('access_token', data.accessToken);
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
      if (window.navigator.onLine) {
        await api.post('/auth/logout');
      }
    } catch {
      // Ignore network errors during logout
    } finally {
      if (user) {
        await wipeUserDataOnLogout(user.id);
      }
      localStorage.removeItem('access_token');
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

