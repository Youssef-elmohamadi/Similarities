import { QuranSearchResponse, VerseSearchResult, VerseContext } from '@/types/quran';
import { getQuranDB, CompactVerse, CompactSurah } from './quranDb';
import { CompactSearchResultPayload } from './binaryIndexEngine';

let worker: Worker | null = null;
let msgIdCounter = 0;
let activeSearchRequestId = 0;
const pendingCallbacks = new Map<
  number,
  {
    resolve: (data: any) => void;
    reject: (err: any) => void;
    requestId?: number;
  }
>();

let isWorkerReady = false;
let initPromise: Promise<boolean> | null = null;

// Lightweight in-memory caches for main thread hydration of visible page items (20-30 verses)
const surahCache = new Map<number, CompactSurah>();
const verseCache = new Map<number, CompactVerse>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const { id, type, data, error, requestId } = e.data;
      const cb = pendingCallbacks.get(id);
      if (!cb) return;
      pendingCallbacks.delete(id);

      if (type === 'ERROR') {
        cb.reject(new Error(error));
      } else {
        // Drop response if a newer search request superseded it
        if (requestId && cb.requestId && requestId < activeSearchRequestId) {
          return;
        }
        cb.resolve(data);
      }
    };
    worker.onerror = (err) => {
      console.error('Local search worker error event:', err);
    };
  }
  return worker;
}

export function isLocalWorkerReady(): boolean {
  return isWorkerReady;
}

export function initLocalWorker(): Promise<boolean> {
  if (isWorkerReady) return Promise.resolve(true);
  if (initPromise) return initPromise;

  const w = getWorker();
  const id = ++msgIdCounter;
  initPromise = new Promise<boolean>((resolve, reject) => {
    pendingCallbacks.set(id, {
      resolve: (data) => {
        isWorkerReady = true;
        initPromise = null;
        resolve(data?.isReady ?? true);
      },
      reject: (err) => {
        isWorkerReady = false;
        initPromise = null;
        reject(err);
      },
    });
    w.postMessage({ id, type: 'INIT' });
  });

  return initPromise;
}

/**
 * Hydrates lightweight compact search results with full verse texts and surah names for ONLY the visible page (20-30 items)
 */
async function hydrateCompactPayload(compact: CompactSearchResultPayload): Promise<QuranSearchResponse> {
  const db = await getQuranDB();

  // Populate surahs cache if empty
  if (surahCache.size === 0) {
    const surahs = await db.getAll('surahs');
    for (const s of surahs) {
      surahCache.set(s.id, s);
    }
  }

  // Load missing verses for only the visible page
  const missingIds = compact.pagedItems.filter(p => !verseCache.has(p.id)).map(p => p.id);
  if (missingIds.length > 0) {
    const tx = db.transaction('verses', 'readonly');
    await Promise.all(
      missingIds.map(async id => {
        const v = await tx.store.get(id);
        if (v) verseCache.set(id, v);
      })
    );
  }

  const items: VerseSearchResult[] = compact.pagedItems.map(p => {
    const v = verseCache.get(p.id);
    const s = surahCache.get(p.surahId);
    return {
      id: p.id,
      surahId: p.surahId,
      ayahNumber: p.ayahNumber,
      juzNumber: p.juzNumber,
      surahNameArabic: s?.nameArabic || '',
      surahNameEnglish: s?.nameEnglish || '',
      uthmaniText: v?.uthmaniText || '',
      normalizedText: v?.normalizedText || '',
      matchedWordIndexes: p.matchedWordIndexes,
      matchCount: p.matchedWordIndexes.length,
      relevanceScore: p.relevanceScore,
      isDirectReference: p.isDirectReference ?? false,
      matchLevel: (p.matchLevel as any) || 'phonetic',
      matchedWordKinds: p.matchedWordKinds,
      bestMatchKind: p.bestMatchKind,
    };
  });

  return {
    items,
    totalCount: compact.totalCount,
    page: compact.page,
    pageSize: compact.pageSize,
    totalPages: compact.totalPages,
    hasNextPage: compact.hasNextPage,
    hasPreviousPage: compact.hasPreviousPage,
    totalWordOccurrences: compact.totalWordOccurrences,
    executionTimeMs: compact.executionTimeMs,
    facets: compact.facets,
    directReferenceFound: compact.directReferenceFound,
    exactMatchesCount: compact.exactMatchesCount,
    partialMatchesCount: compact.partialMatchesCount,
    searchHint: compact.searchHint,
  };
}

export async function searchLocalWorker(params: any): Promise<QuranSearchResponse> {
  // If worker is still initializing, queue query until worker is ready
  if (!isWorkerReady) {
    try {
      await initLocalWorker();
    } catch (e) {
      console.warn('Worker initialization before search failed:', e);
    }
  }

  const reqId = ++activeSearchRequestId;
  const w = getWorker();
  const id = ++msgIdCounter;

  const rawCompact = await new Promise<CompactSearchResultPayload>((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject, requestId: reqId });
    w.postMessage({ id, type: 'SEARCH', payload: params, requestId: reqId });
  });

  // Hydrate only the visible page
  return hydrateCompactPayload(rawCompact);
}

export async function getLocalVerseContext(
  verseId: number,
  before: number = 1,
  after: number = 1
): Promise<VerseContext | null> {
  if (!isWorkerReady) {
    try {
      await initLocalWorker();
    } catch (e) {
      console.warn('Worker initialization before context failed:', e);
    }
  }

  const w = getWorker();
  const id = ++msgIdCounter;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    w.postMessage({ id, type: 'CONTEXT', payload: { verseId, before, after } });
  });
}

// Eagerly initialize Web Worker right after first paint on idle callback
if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(
      () => {
        initLocalWorker().catch(() => {});
      },
      { timeout: 2000 }
    );
  } else {
    setTimeout(() => {
      initLocalWorker().catch(() => {});
    }, 300);
  }
}
