import { openDB } from 'idb';
import { Persister, PersistedClient } from '@tanstack/query-persist-client-core';

const CACHE_DB_NAME = 'QuranQueryCacheDB';
const CACHE_STORE_NAME = 'clientCache';
const CACHE_KEY = 'QUERY_CLIENT_CACHE';

/**
 * Creates an async IndexedDB persister for TanStack Query.
 * Does NOT block app shell rendering; restores cache asynchronously in the background.
 */
export function createIndexedDbPersister(): Persister {
  const getDb = () =>
    openDB(CACHE_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME);
        }
      },
    });

  return {
    persistClient: async (client: PersistedClient) => {
      try {
        const db = await getDb();
        await db.put(CACHE_STORE_NAME, client, CACHE_KEY);
      } catch (err) {
        console.warn('Failed to persist query cache to IndexedDB:', err);
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const db = await getDb();
        return await db.get(CACHE_STORE_NAME, CACHE_KEY);
      } catch (err) {
        console.warn('Failed to restore query cache from IndexedDB:', err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        const db = await getDb();
        await db.delete(CACHE_STORE_NAME, CACHE_KEY);
      } catch (err) {
        console.warn('Failed to remove query cache from IndexedDB:', err);
      }
    },
  };
}

