import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { AppFooter } from './AppFooter';
import { Seo } from '../common/Seo';
import { prefetchRouteChunks } from '../../routes/routePrefetch';
import { useAuth } from '../../context/AuthContext';
import { Loader2, AlertTriangle, X } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isReauthRequired, clearReauthWarning } = useAuth();

  useEffect(() => {
    prefetchRouteChunks();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary">
      <Seo robots="noindex, nofollow" />
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
      />
      {isReauthRequired && (
        <aside
          role="alert"
          className="bg-amber-500/10 border-b border-amber-500/20 px-3 sm:px-6 py-2 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              انتهت صلاحية جلسة المزامنة السحابية. بياناتك ومجموعاتك محفوظة محلياً بالكامل،{' '}
              <Link to="/login" className="font-bold underline text-primary hover:opacity-80 ms-1 inline-block">
                سجّل الدخول لإكمال المزامنة
              </Link>
            </span>
          </div>
          <button
            type="button"
            onClick={clearReauthWarning}
            className="p-1 rounded text-text-secondary hover:text-text-primary text-xs shrink-0"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}
      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-3 sm:py-6 md:py-8 pb-28 md:pb-12 min-w-0 flex flex-col justify-between">
          <div className="flex-1">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center p-8 min-h-[40vh]" aria-busy="true">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
          <AppFooter className="mt-12" />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};
