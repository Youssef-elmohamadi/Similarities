import { getQuranDB } from './quranDb';
import { LocalQuranSearchEngine } from './localSearchEngine';

const searchEngine = new LocalQuranSearchEngine();
let isInitializing = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (searchEngine.isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await getQuranDB();
      const surahs = await db.getAll('surahs');
      const verses = await db.getAll('verses');
      const words = await db.getAll('words');

      if (surahs.length > 0 && verses.length > 0) {
        searchEngine.init(surahs, verses, words);
      }
    } catch (err) {
      console.error('Error loading dataset into Web Worker:', err);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;

  try {
    if (type === 'INIT') {
      await ensureInitialized();
      self.postMessage({ id, type: 'INIT_SUCCESS', isReady: searchEngine.isReady });
    } else if (type === 'SEARCH') {
      await ensureInitialized();
      if (!searchEngine.isReady) {
        throw new Error('Local search engine dataset is not loaded in IndexedDB');
      }
      const response = searchEngine.search(payload);
      self.postMessage({ id, type: 'SEARCH_SUCCESS', data: response });
    } else if (type === 'CONTEXT') {
      await ensureInitialized();
      const context = searchEngine.getVerseContext(payload.verseId, payload.before, payload.after);
      self.postMessage({ id, type: 'CONTEXT_SUCCESS', data: context });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, type: 'ERROR', error: errorMsg });
  }
};

