import { QuranSearchResponse, VerseContext } from '@/types/quran';

let worker: Worker | null = null;
let msgIdCounter = 0;
const pendingCallbacks = new Map<number, { resolve: (data: any) => void; reject: (err: any) => void }>();

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
  }
  return worker;
}

export function initLocalWorker(): Promise<boolean> {
  const w = getWorker();
  const id = ++msgIdCounter;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    w.postMessage({ id, type: 'INIT' });
  });
}

export function searchLocalWorker(params: any): Promise<QuranSearchResponse> {
  const w = getWorker();
  const id = ++msgIdCounter;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    w.postMessage({ id, type: 'SEARCH', payload: params });
  });
}

export function getLocalVerseContext(verseId: number, before: number = 1, after: number = 1): Promise<VerseContext | null> {
  const w = getWorker();
  const id = ++msgIdCounter;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    w.postMessage({ id, type: 'CONTEXT', payload: { verseId, before, after } });
  });
}

