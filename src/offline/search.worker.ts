import { getQuranDB, getStoredBinaryIndex, storeBinaryIndex } from './quranDb';
import { BinaryQuranSearchEngine } from './binaryIndexEngine';

const searchEngine = new BinaryQuranSearchEngine();
let initPromise: Promise<void> | null = null;
let latestRequestId = 0;

async function ensureInitialized(): Promise<void> {
  if (searchEngine.isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await getQuranDB();
      const versionHash = (await db.get('metadata', 'versionHash')) || '';
      if (!versionHash) return;

      const surahs = await db.getAll('surahs');
      const verses = await db.getAll('verses');

      if (surahs.length === 0 || verses.length === 0) return;

      // 1. Try 1-read load from prebuilt binary index in IndexedDB
      const cachedBinaryIndex = await getStoredBinaryIndex(versionHash);
      if (cachedBinaryIndex) {
        searchEngine.loadSerializedIndex(cachedBinaryIndex, verses);
        return;
      }

      // 2. If not found, build once from words and persist
      const words = await db.getAll('words');
      if (words.length > 0) {
        const serialized = searchEngine.buildAndInit(surahs, verses, words, versionHash);
        await storeBinaryIndex(versionHash, serialized);
      }
    } catch (err) {
      console.error('Error loading binary index into Web Worker:', err);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload, requestId } = e.data;

  try {
    if (type === 'INIT') {
      await ensureInitialized();
      self.postMessage({ id, type: 'INIT_SUCCESS', isReady: searchEngine.isReady });
    } else if (type === 'SEARCH') {
      const reqId = typeof requestId === 'number' ? requestId : 0;
      if (reqId > 0) {
        if (reqId < latestRequestId) {
          // Superseded query, drop without processing
          return;
        }
        latestRequestId = reqId;
      }

      await ensureInitialized();
      if (!searchEngine.isReady) {
        throw new Error('Local search engine dataset is not loaded in IndexedDB');
      }

      // Check if a newer query arrived while waiting for initialization
      if (reqId > 0 && reqId < latestRequestId) {
        return;
      }

      const response = searchEngine.searchCompact(payload, reqId);

      // Check if superseded while running search
      if (reqId > 0 && reqId < latestRequestId) {
        return;
      }

      self.postMessage({ id, type: 'SEARCH_SUCCESS', requestId: reqId, data: response });
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
