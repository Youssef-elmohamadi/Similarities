import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, type, message, title, duration };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (message: string, title?: string) => addToast('success', message, title),
    error: (message: string, title?: string) => addToast('error', message, title),
    info: (message: string, title?: string) => addToast('info', message, title),
    warning: (message: string, title?: string) => addToast('warning', message, title),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container: RTL logical positioning */}
      <div className="fixed bottom-5 start-4 end-4 sm:end-auto sm:start-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map(item => (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-card transition-all duration-200 transform translate-y-0 opacity-100 bg-surface',
              item.type === 'success' && 'border-success/30 bg-success-subtle text-text-primary',
              item.type === 'error' && 'border-danger/30 bg-danger-subtle text-text-primary',
              item.type === 'warning' && 'border-warning/30 bg-warning-subtle text-text-primary',
              item.type === 'info' && 'border-primary/30 bg-primary-tint text-text-primary'
            )}
          >
            <div className="shrink-0 mt-0.5">
              {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-success" />}
              {item.type === 'error' && <AlertCircle className="w-5 h-5 text-danger" />}
              {item.type === 'warning' && <AlertTriangle className="w-5 h-5 text-warning" />}
              {item.type === 'info' && <Info className="w-5 h-5 text-primary" />}
            </div>

            <div className="flex-1 text-sm text-start">
              {item.title && <p className="font-semibold mb-0.5 text-text-primary leading-snug">{item.title}</p>}
              <p className="text-text-secondary leading-relaxed text-xs sm:text-sm">{item.message}</p>
            </div>

            <button
              onClick={() => removeToast(item.id)}
              className="shrink-0 min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-text-secondary hover:text-text-primary rounded-md transition"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
