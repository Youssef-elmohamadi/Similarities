import { QuranSearchResponse, VerseContext } from '@/types/quran';

let worker: Worker | null = null;
let msgIdCounter = 0;
const pendingCallbacks = new Map<number, { resolve: (data: any) => void; reject: (err: any) => void }>();

let isWorkerReady = false;
let initPromise: Promise<boolean> | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const { id, type, data, error } = e.data;
      const cb = pendingCallbacks.get(id);
      if (!cb) return;
      pendingCallbacks.delete(id);

      if (type === 'ERROR') {
        cb.reject(new Error(error));
      } else {
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

export async function searchLocalWorker(params: any): Promise<QuranSearchResponse> {
  // If worker is still initializing, queue query until worker is ready
  if (!isWorkerReady) {
    try {
      await initLocalWorker();
    } catch (e) {
      console.warn('Worker initialization before search failed:', e);
    }
  }

  const w = getWorker();
  const id = ++msgIdCounter;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    w.postMessage({ id, type: 'SEARCH', payload: params });
  });
}

export async function getLocalVerseContext(verseId: number, before: number = 1, after: number = 1): Promise<VerseContext | null> {
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

// Eagerly initialize Web Worker at app start in browser
if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
  initLocalWorker().catch(() => {
    // If dataset not yet in IndexedDB, worker will wait until dataset is saved
  });
}
