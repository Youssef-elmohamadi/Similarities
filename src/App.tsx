import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createIndexedDbPersister } from './offline/queryPersister';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { PwaProvider } from './context/PwaContext';
import { DatasetProvider } from './context/DatasetContext';
import { ToastProvider } from './components/common/Toast';
import { AppRoutes } from './routes/AppRoutes';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
    mutations: {
      networkMode: 'always',
    },
  },
});

if (typeof window !== 'undefined') {
  (window as any).__queryClient = queryClient;

  // Asynchronous background hydration; never blocks initial render
  persistQueryClient({
    queryClient,
    persister: createIndexedDbPersister(),
    maxAge: 1000 * 60 * 60 * 24 * 7,
    dehydrateOptions: {
      shouldDehydrateQuery: query => query.state.status === 'success',
    },
  });
}

export const App: React.FC = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <DatasetProvider>
                <PwaProvider>
                  <ToastProvider>
                    <AppRoutes />
                  </ToastProvider>
                </PwaProvider>
              </DatasetProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;

