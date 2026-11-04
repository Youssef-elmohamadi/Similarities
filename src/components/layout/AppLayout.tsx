import React, { useState, useEffect, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { AppFooter } from './AppFooter';
import { Seo } from '../common/Seo';
import { prefetchRouteChunks } from '../../routes/routePrefetch';
import { Loader2 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
