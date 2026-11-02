import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface CompactSurah {
  id: number;
  number: number;
  nameArabic: string;
  nameEnglish: string;
  ayahCount: number;
  revelationType: string;
  bismillahText?: string | null;
}

export interface CompactVerse {
  id: number;
  surahId: number;
  ayahNumber: number;
  juzNumber: number;
  uthmaniText: string;
  normalizedText: string;
  consonantalSkeleton: string;
}

export interface CompactWord {
  verseId: number;
  wordIndex: number;
  originalWord: string;
  normalizedWord: string;
  skeletonWord: string;
  phoneticWord: string;
}

export interface QuranDataset {
  versionHash: string;
  totalSurahs: number;
  totalVerses: number;
  totalWords: number;
  surahs: CompactSurah[];
  verses: CompactVerse[];
  words: CompactWord[];
}

interface QuranDBSchema extends DBSchema {
  metadata: {
    key: string;
    value: string;
  };
  surahs: {
    key: number; // id
    value: CompactSurah;
    indexes: { 'by-number': number };
  };
  verses: {
    key: number; // id
    value: CompactVerse;
    indexes: { 'by-surah': number; 'by-juz': number };
  };
  words: {
    key: number; // auto-increment id
    value: CompactWord;
    indexes: {
      'by-verse': number;
      'by-normalized': string;
      'by-phonetic': string;
      'by-skeleton': string;
    };
  };
}

const DB_NAME = 'QuranOfflineDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<QuranDBSchema>> | null = null;

export function getQuranDB(): Promise<IDBPDatabase<QuranDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<QuranDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
        // Surahs store
        if (!db.objectStoreNames.contains('surahs')) {
          const surahStore = db.createObjectStore('surahs', { keyPath: 'id' });
          surahStore.createIndex('by-number', 'number');
        }
        // Verses store
        if (!db.objectStoreNames.contains('verses')) {
          const verseStore = db.createObjectStore('verses', { keyPath: 'id' });
          verseStore.createIndex('by-surah', 'surahId');
          verseStore.createIndex('by-juz', 'juzNumber');
        }
        // Words store
        if (!db.objectStoreNames.contains('words')) {
          const wordStore = db.createObjectStore('words', { autoIncrement: true });
          wordStore.createIndex('by-verse', 'verseId');
          wordStore.createIndex('by-normalized', 'normalizedWord');
          wordStore.createIndex('by-phonetic', 'phoneticWord');
          wordStore.createIndex('by-skeleton', 'skeletonWord');
        }
      },
    });
  }
  return dbPromise;
}

let isDatasetCachedAvailable: boolean | null = null;

export async function getStoredDatasetVersion(): Promise<string | null> {
  try {
    const db = await getQuranDB();
    const ver = await db.get('metadata', 'versionHash');
    if (ver) {
      isDatasetCachedAvailable = true;
    }
    return ver || null;
  } catch {
    return null;
  }
}

export async function isOfflineDatasetAvailable(): Promise<boolean> {
  if (isDatasetCachedAvailable === true) return true;
  const version = await getStoredDatasetVersion();
  isDatasetCachedAvailable = Boolean(version);
  return isDatasetCachedAvailable;
}

export function isOfflineDatasetAvailableSync(): boolean {
  return isDatasetCachedAvailable === true;
}

export async function getCompactVerseById(id: number): Promise<CompactVerse | undefined> {
  try {
    const db = await getQuranDB();
    return await db.get('verses', id);
  } catch {
    return undefined;
  }
}

export async function getSurahById(id: number): Promise<CompactSurah | undefined> {
  try {
    const db = await getQuranDB();
    return await db.get('surahs', id);
  } catch {
    return undefined;
  }
}

export async function getFullVerseById(id: number): Promise<any | null> {
  try {
    const db = await getQuranDB();
    const verse = await db.get('verses', id);
    if (!verse) return null;
    const surah = await db.get('surahs', verse.surahId);
    return {
      id: verse.id,
      surahId: verse.surahId,
      surahNumber: surah ? surah.number : verse.surahId,
      surahNameArabic: surah ? surah.nameArabic : '',
      surahNameEnglish: surah ? surah.nameEnglish : '',
      ayahNumber: verse.ayahNumber,
      juzNumber: verse.juzNumber,
      uthmaniText: verse.uthmaniText,
      normalizedText: verse.normalizedText,
      consonantalSkeleton: verse.consonantalSkeleton,
    };
  } catch {
    return null;
  }
}

export async function getFullVersesByIds(ids: number[]): Promise<any[]> {
  try {
    const verses: any[] = [];
    for (const id of ids) {
      const v = await getFullVerseById(id);
      if (v) verses.push(v);
    }
    return verses;
  } catch {
    return [];
  }
}

// Compute deterministic SHA-256 in browser using Web Crypto API
export async function computeVersesSha256(verses: CompactVerse[]): Promise<string> {
  // Sort by id
  const sorted = [...verses].sort((a, b) => a.id - b.id);
  const encoder = new TextEncoder();
  let fullText = '';
  for (const v of sorted) {
    fullText += v.uthmaniText;
  }
  const data = encoder.encode(fullText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveDatasetToIndexedDB(
  dataset: QuranDataset,
  onProgress?: (progress: number, stage: string) => void
): Promise<boolean> {
  const db = await getQuranDB();

  // 1. Verify byte-identical hash of UthmaniText across all verses
  onProgress?.(10, 'جاري التحقق من سلامة النص القرآني والرسم العثماني...');
  const computedHash = await computeVersesSha256(dataset.verses);

  if (computedHash.toLowerCase() !== dataset.versionHash.toLowerCase()) {
    console.error('Hash mismatch! Expected:', dataset.versionHash, 'Computed:', computedHash);
    throw new Error('تطابق النص القرآني غير متطابق مع الخادم، تم إلغاء الحفظ.');
  }

  // 2. Clear existing data
  onProgress?.(25, 'جاري إعداد قاعدة البيانات المحلية...');
  const txClear = db.transaction(['surahs', 'verses', 'words', 'metadata'], 'readwrite');
  await txClear.objectStore('surahs').clear();
  await txClear.objectStore('verses').clear();
  await txClear.objectStore('words').clear();
  await txClear.objectStore('metadata').clear();
  await txClear.done;

  // 3. Insert Surahs
  onProgress?.(35, 'جاري حفظ السور الكريمة...');
  const txSurahs = db.transaction('surahs', 'readwrite');
  for (const s of dataset.surahs) {
    txSurahs.store.put(s);
  }
  await txSurahs.done;

  // 4. Insert Verses
  onProgress?.(55, 'جاري حفظ الآيات والرسم العثماني...');
  const txVerses = db.transaction('verses', 'readwrite');
  for (const v of dataset.verses) {
    txVerses.store.put(v);
  }
  await txVerses.done;

  // 5. Insert Words in chunks of 5000 for high performance
  onProgress?.(75, 'جاري حفظ الكلمات والفهارس الصوتية...');
  const chunkSize = 5000;
  for (let i = 0; i < dataset.words.length; i += chunkSize) {
    const chunk = dataset.words.slice(i, i + chunkSize);
    const txWords = db.transaction('words', 'readwrite');
    for (const w of chunk) {
      txWords.store.put(w);
    }
    await txWords.done;
    const pct = Math.min(95, 75 + Math.round((i / dataset.words.length) * 20));
    onProgress?.(pct, `جاري حفظ الكلمات (${i + chunk.length} / ${dataset.words.length})...`);
  }

  // 6. Record metadata
  const txMeta = db.transaction('metadata', 'readwrite');
  await txMeta.store.put(dataset.versionHash, 'versionHash');
  await txMeta.store.put(new Date().toISOString(), 'installedAt');
  await txMeta.done;

  onProgress?.(100, 'اكتمل تحميل المصحف الشريف للعمل بدون إنترنت بنجاح.');
  isDatasetCachedAvailable = true;
  return true;
}
