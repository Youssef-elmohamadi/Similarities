/**
 * Route-level prefetch manager.
 * Executed after the initial app shell is idle (via requestIdleCallback),
 * pre-loading the code-split chunks for all primary routes so that offline
 * transitions between screens are instantaneous and zero-wait.
 */

let hasPrefetched = false;

export const prefetchRouteChunks = () => {
  if (typeof window === 'undefined' || hasPrefetched) return;
  hasPrefetched = true;

  const loaders = [
    () => import('../pages/QuranSearchPage'),
    () => import('../pages/MyLibraryPage'),
    () => import('../pages/CollectionDetailsPage'),
    () => import('../pages/SettingsPage'),
    () => import('../pages/DashboardPage'),
    () => import('../pages/CreateCollectionPage'),
    () => import('../pages/EditCollectionPage'),
  ];

  const runPrefetch = () => {
    loaders.forEach(load => {
      try {
        load();
      } catch {
        // Silently catch any prefetch error in background
      }
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runPrefetch, { timeout: 3000 });
  } else {
    setTimeout(runPrefetch, 1000);
  }
};

