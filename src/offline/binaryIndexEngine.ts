/**
 * High-Performance Binary Inverted Index & Search Engine for Quran Similarities
 *
 * Architecture:
 * 1. Prebuilt Compact Index:
 *    - Sorted distinct-word dictionaries for each basis (exact, spelling, phonetic, skeleton).
 *    - Postings stored as packed 32-bit integers: (verseId << 8) | wordIndex in contiguous Uint32Array.
 *    - Word pointers (offsets: Uint32Array, lengths: Uint16Array) for O(1) posting slice access.
 *    - Compact verse metadata: verseSurahIds (Uint8Array), verseAyahNumbers (Uint16Array), verseJuzNumbers (Uint8Array).
 * 2. O(log N) Query Path:
 *    - Exact match: binarySearchExact O(log N).
 *    - StartsWith match: binarySearchRange O(log N).
 *    - Contains match: distinct dictionary scan with early exit & candidate cap (500).
 * 3. Memoized Token Normalization:
 *    - LRU/Map memoization of parsed and normalized query tokens.
 * 4. Zero-Allocation Hot Loops:
 *    - Verse ID direct indexing (array size 6237).
 *    - Minimal postMessage transfer payloads with main-thread hydration.
 */

import { CompactSurah, CompactVerse, CompactWord } from './quranDb';
import {
  normalizeArabic,
  toPhonetic,
  toConsonantalSkeleton,
  parseQuery,
} from './arabicNormalizer';
import {
  QuranSearchResponse,
  VerseSearchResult,
  SearchMode,
  MatchBasis,
  SortOption,
  SurahFacet,
} from '../types/quran';

export type MatchKind = 'exact' | 'startsWith' | 'contains';

export interface CompactIndexSlice {
  dictionary: string[];
  wordOffsets: Uint32Array;
  wordLengths: Uint16Array;
  packedPostings: Uint32Array;
}

export interface SerializedBinaryIndex {
  versionHash: string;
  original: CompactIndexSlice;
  normalized: CompactIndexSlice;
  phonetic: CompactIndexSlice;
  skeleton: CompactIndexSlice;
  verseSurahIds: Uint8Array;
  verseAyahNumbers: Uint16Array;
  verseJuzNumbers: Uint8Array;
  verseWordCounts?: Uint8Array;
  surahs: Array<{
    id: number;
    number: number;
    nameArabic: string;
    nameEnglish: string;
    ayahCount: number;
  }>;
}

export interface CompactSearchResultPayload {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalWordOccurrences: number;
  executionTimeMs: number;
  facets: SurahFacet[];
  directReferenceFound: boolean;
  exactMatchesCount: number;
  partialMatchesCount: number;
  searchHint?: string;
  pagedItems: Array<{
    id: number;
    surahId: number;
    ayahNumber: number;
    juzNumber: number;
    matchedWordIndexes: number[];
    matchedWordKinds: Record<number, MatchKind>;
    bestMatchKind: MatchKind;
    relevanceScore: number;
    matchLevel: string;
    isDirectReference?: boolean;
  }>;
}

// Binary search utilities
export function binarySearchExact(dictionary: string[], target: string): number {
  let low = 0;
  let high = dictionary.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const val = dictionary[mid];
    if (val === target) return mid;
    if (val < target) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}

export function binarySearchLowerBound(dictionary: string[], target: string): number {
  let low = 0;
  let high = dictionary.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (dictionary[mid] >= target) high = mid;
    else low = mid + 1;
  }
  return low;
}

export function binarySearchPrefixRange(dictionary: string[], prefix: string): [number, number] {
  const low = binarySearchLowerBound(dictionary, prefix);
  const high = binarySearchLowerBound(dictionary, prefix + '\uFFFF');
  return [low, high];
}

// Memoized normalization cache
const normCache = new Map<string, string>();
const phoneticCache = new Map<string, string>();
const skeletonCache = new Map<string, string>();

function getNormalizedToken(w: string, isRoot: boolean, matchBy: MatchBasis): string {
  if (isRoot) {
    let res = skeletonCache.get(w);
    if (!res) {
      res = toConsonantalSkeleton(w);
      skeletonCache.set(w, res);
    }
    return res;
  }
  if (matchBy === 'exact') return w;
  if (matchBy === 'spelling') {
    let res = normCache.get(w);
    if (!res) {
      res = normalizeArabic(w);
      normCache.set(w, res);
    }
    return res;
  }
  let res = phoneticCache.get(w);
  if (!res) {
    res = toPhonetic(w);
    phoneticCache.set(w, res);
  }
  return res;
}

export class BinaryQuranSearchEngine {
  public isReady = false;
  private versionHash: string = '';

  private originalIndex!: CompactIndexSlice;
  private normalizedIndex!: CompactIndexSlice;
  private phoneticIndex!: CompactIndexSlice;
  private skeletonIndex!: CompactIndexSlice;

  private verseSurahIds!: Uint8Array;
  private verseAyahNumbers!: Uint16Array;
  private verseJuzNumbers!: Uint8Array;
  private verseWordCounts!: Uint8Array;

  // Metadata tables
  private surahs: CompactSurah[] = [];
  private surahMap = new Map<number, CompactSurah>();
  private surahNumberMap = new Map<number, CompactSurah>();
  private verses: CompactVerse[] = [];
  private verseMap = new Map<number, CompactVerse>();
  private verseWordsMap = new Map<number, CompactWord[]>();

  // Cancellation token
  public currentRequestId: number = 0;

  /**
   * Initialize from pre-built serialized binary index (instant 1-read load)
   */
  public loadSerializedIndex(
    arg1: SerializedBinaryIndex | CompactSurah[],
    arg2?: CompactVerse[] | CompactVerse[],
    arg3?: CompactWord[] | SerializedBinaryIndex
  ) {
    let serialized: SerializedBinaryIndex;
    let verses: CompactVerse[] = [];
    let words: CompactWord[] = [];

    if (arg1 && typeof arg1 === 'object' && 'original' in arg1) {
      serialized = arg1 as SerializedBinaryIndex;
      verses = (arg2 as CompactVerse[]) || [];
      words = (arg3 as CompactWord[]) || [];
    } else if (arg3 && typeof arg3 === 'object' && 'original' in arg3) {
      serialized = arg3 as SerializedBinaryIndex;
      verses = (arg2 as CompactVerse[]) || [];
    } else {
      throw new Error('Invalid arguments to loadSerializedIndex');
    }

    this.versionHash = serialized.versionHash;
    this.originalIndex = serialized.original;
    this.normalizedIndex = serialized.normalized;
    this.phoneticIndex = serialized.phonetic;
    this.skeletonIndex = serialized.skeleton;

    this.verseSurahIds = serialized.verseSurahIds;
    this.verseAyahNumbers = serialized.verseAyahNumbers;
    this.verseJuzNumbers = serialized.verseJuzNumbers;
    this.verseWordCounts = serialized.verseWordCounts || new Uint8Array(6237);

    this.surahs = serialized.surahs.map(s => ({
      id: s.id,
      number: s.number,
      nameArabic: s.nameArabic,
      nameEnglish: s.nameEnglish,
      ayahCount: s.ayahCount,
      revelationType: '',
    }));

    this.surahMap.clear();
    this.surahNumberMap.clear();
    for (const s of this.surahs) {
      this.surahMap.set(s.id, s);
      this.surahNumberMap.set(s.number, s);
    }

    this.verses = verses;
    this.verseMap.clear();
    this.verseWordsMap.clear();
    for (const v of verses) {
      this.verseMap.set(v.id, v);
      this.verseWordsMap.set(v.id, []);
    }

    for (const w of words) {
      const vWords = this.verseWordsMap.get(w.verseId);
      if (vWords) vWords.push(w);
      if (w.wordIndex > this.verseWordCounts[w.verseId]) {
        this.verseWordCounts[w.verseId] = w.wordIndex;
      }
    }

    this.isReady = true;
  }

  /**
   * Serialize currently built index for IndexedDB / Cache persistence
   */
  public serializeIndex(): SerializedBinaryIndex {
    return {
      versionHash: this.versionHash,
      original: this.originalIndex,
      normalized: this.normalizedIndex,
      phonetic: this.phoneticIndex,
      skeleton: this.skeletonIndex,
      verseSurahIds: this.verseSurahIds,
      verseAyahNumbers: this.verseAyahNumbers,
      verseJuzNumbers: this.verseJuzNumbers,
      verseWordCounts: this.verseWordCounts,
      surahs: this.surahs.map(s => ({
        id: s.id,
        number: s.number,
        nameArabic: s.nameArabic,
        nameEnglish: s.nameEnglish,
        ayahCount: s.ayahCount,
      })),
    };
  }

  /**
   * Build binary index from raw dataset and return the serialized structure
   */
  public buildAndInit(
    arg1: string | CompactSurah[],
    arg2: CompactSurah[] | CompactVerse[],
    arg3: CompactVerse[] | CompactWord[],
    arg4?: CompactWord[] | string
  ): SerializedBinaryIndex {
    let versionHash = '';
    let surahs: CompactSurah[] = [];
    let verses: CompactVerse[] = [];
    let words: CompactWord[] = [];

    if (typeof arg1 === 'string') {
      versionHash = arg1;
      surahs = arg2 as CompactSurah[];
      verses = arg3 as CompactVerse[];
      words = (arg4 as CompactWord[]) || [];
    } else {
      surahs = arg1 as CompactSurah[];
      verses = arg2 as CompactVerse[];
      words = (arg3 as CompactWord[]) || [];
      versionHash = (arg4 as string) || '';
    }

    this.versionHash = versionHash;
    this.surahs = surahs;
    this.verses = verses;

    this.surahMap.clear();
    this.surahNumberMap.clear();
    for (const s of surahs) {
      this.surahMap.set(s.id, s);
      this.surahNumberMap.set(s.number, s);
    }

    this.verseMap.clear();
    this.verseWordsMap.clear();
    for (const v of verses) {
      this.verseMap.set(v.id, v);
      this.verseWordsMap.set(v.id, []);
    }

    // Build verse fast lookup arrays (max verse ID is ~6236, size 6237)
    this.verseSurahIds = new Uint8Array(6237);
    this.verseAyahNumbers = new Uint16Array(6237);
    this.verseJuzNumbers = new Uint8Array(6237);
    this.verseWordCounts = new Uint8Array(6237);

    for (const v of verses) {
      this.verseSurahIds[v.id] = v.surahId;
      this.verseAyahNumbers[v.id] = v.ayahNumber;
      this.verseJuzNumbers[v.id] = v.juzNumber;
    }

    // Group postings for each normalization basis
    const origMap = new Map<string, number[]>();
    const normMap = new Map<string, number[]>();
    const phonMap = new Map<string, number[]>();
    const skelMap = new Map<string, number[]>();

    for (const w of words) {
      const vWords = this.verseWordsMap.get(w.verseId);
      if (vWords) vWords.push(w);

      if (w.wordIndex > this.verseWordCounts[w.verseId]) {
        this.verseWordCounts[w.verseId] = w.wordIndex;
      }

      const packed = (w.verseId << 8) | (w.wordIndex & 0xff);

      if (w.originalWord) {
        let arr = origMap.get(w.originalWord);
        if (!arr) { arr = []; origMap.set(w.originalWord, arr); }
        arr.push(packed);
      }
      if (w.normalizedWord) {
        let arr = normMap.get(w.normalizedWord);
        if (!arr) { arr = []; normMap.set(w.normalizedWord, arr); }
        arr.push(packed);
      }
      if (w.phoneticWord) {
        let arr = phonMap.get(w.phoneticWord);
        if (!arr) { arr = []; phonMap.set(w.phoneticWord, arr); }
        arr.push(packed);
      }
      if (w.skeletonWord) {
        let arr = skelMap.get(w.skeletonWord);
        if (!arr) { arr = []; skelMap.set(w.skeletonWord, arr); }
        arr.push(packed);
      }
    }

    const buildSlice = (map: Map<string, number[]>): CompactIndexSlice => {
      const sortedKeys = Array.from(map.keys()).sort();
      const count = sortedKeys.length;
      const wordOffsets = new Uint32Array(count);
      const wordLengths = new Uint16Array(count);

      let totalPostings = 0;
      for (let i = 0; i < count; i++) {
        totalPostings += map.get(sortedKeys[i])!.length;
      }

      const packedPostings = new Uint32Array(totalPostings);
      let currentOffset = 0;

      for (let i = 0; i < count; i++) {
        const key = sortedKeys[i];
        const arr = map.get(key)!;
        wordOffsets[i] = currentOffset;
        wordLengths[i] = arr.length;
        packedPostings.set(arr, currentOffset);
        currentOffset += arr.length;
      }

      return {
        dictionary: sortedKeys,
        wordOffsets,
        wordLengths,
        packedPostings,
      };
    };

    this.originalIndex = buildSlice(origMap);
    this.normalizedIndex = buildSlice(normMap);
    this.phoneticIndex = buildSlice(phonMap);
    this.skeletonIndex = buildSlice(skelMap);

    this.isReady = true;

    return this.serializeIndex();
  }

  private getSlice(isRoot: boolean, matchBy: MatchBasis): CompactIndexSlice {
    if (isRoot) return this.skeletonIndex;
    if (matchBy === 'exact') return this.originalIndex;
    if (matchBy === 'spelling') return this.normalizedIndex;
    return this.phoneticIndex;
  }

  /**
   * Fast candidate distinct-word resolution via binary search & candidate capping
   */
  private findCandidateWords(
    slice: CompactIndexSlice,
    token: string,
    wordMatch: 'smart' | 'whole' | 'partial'
  ): { candidates: Array<{ dictIndex: number; kind: MatchKind; score: number }>; isCapped: boolean } {
    const dict = slice.dictionary;

    if (wordMatch === 'whole') {
      const idx = binarySearchExact(dict, token);
      if (idx >= 0) {
        return {
          candidates: [{ dictIndex: idx, kind: 'exact', score: 3 }],
          isCapped: false,
        };
      }
      return { candidates: [], isCapped: false };
    }

    const candidates: Array<{ dictIndex: number; kind: MatchKind; score: number }> = [];

    // 1. Exact match in O(log N)
    const exactIdx = binarySearchExact(dict, token);
    if (exactIdx >= 0) {
      candidates.push({ dictIndex: exactIdx, kind: 'exact', score: 3 });
    }

    // 2. StartsWith range in O(log N)
    let lowPrefix = -1;
    let highPrefix = -1;
    if (wordMatch === 'smart') {
      const [low, high] = binarySearchPrefixRange(dict, token);
      lowPrefix = low;
      highPrefix = high;
      for (let i = low; i < high; i++) {
        if (i !== exactIdx) {
          candidates.push({ dictIndex: i, kind: 'startsWith', score: 2 });
        }
      }
    }

    // 3. Contains scan (only needed if partial or smart)
    let altStem: string | null = null;
    if (token.startsWith('است') && token.length >= 4) {
      altStem = token.slice(1);
    }

    let isCapped = false;
    for (let i = 0; i < dict.length; i++) {
      if (i >= lowPrefix && i < highPrefix) continue; // Already covered by exact / startsWith

      const key = dict[i];
      if (key.includes(token) || (altStem && key.includes(altStem))) {
        candidates.push({ dictIndex: i, kind: 'contains', score: 1 });
        if (candidates.length >= 500) {
          isCapped = true;
          break;
        }
      }
    }

    // Already naturally ordered: exact (3) -> startsWith (2) -> contains (1)

    return {
      candidates: candidates.length > 500 ? candidates.slice(0, 500) : candidates,
      isCapped: isCapped || candidates.length > 500,
    };
  }

  /**
   * Compact search pipeline producing lightweight payloads for Web Worker transfer
   */
  public searchCompact(
    params: {
      q?: string | null;
      surahId?: number;
      surahIds?: string;
      juz?: number;
      mode?: SearchMode;
      wordMatch?: 'smart' | 'whole' | 'partial' | 'exact';
      matchBy?: MatchBasis;
      diacritics?: boolean;
      sort?: SortOption;
      page?: number;
      pageSize?: number;
    },
    requestId?: number
  ): CompactSearchResultPayload {
    const startTime = performance.now();
    const query = params.q || '';
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
    const mode = params.mode || 'phrase';
    const matchBy = params.matchBy || (params.diacritics ? 'exact' : 'phonetic');
    const rawWordMatch = params.wordMatch || 'smart';
    const wordMatch: 'smart' | 'whole' | 'partial' = rawWordMatch === 'exact' ? 'whole' : rawWordMatch;
    const sort = params.sort || (wordMatch === 'smart' ? 'relevance' : 'mushaf');

    const parsedQuery = parseQuery(query);

    // 1. Direct Reference Check (e.g. 2:255)
    if (parsedQuery.directReference) {
      const { surahNumber, ayahNumber } = parsedQuery.directReference;
      const surah = this.surahNumberMap.get(surahNumber);
      if (surah) {
        const verse = this.verses.find(v => v.surahId === surah.id && v.ayahNumber === ayahNumber);
        if (verse) {
          const vWords = this.verseWordsMap.get(verse.id) || [];
          const wordIndexes = vWords.length > 0
            ? vWords.map(w => w.wordIndex)
            : Array.from({ length: (this.verseWordCounts && this.verseWordCounts[verse.id]) || 1 }, (_, i) => i + 1);
          const executionTimeMs = Math.round(performance.now() - startTime);

          const matchedWordKinds: Record<number, MatchKind> = {};
          for (const idx of wordIndexes) {
            matchedWordKinds[idx] = 'exact';
          }

          return {
            totalCount: 1,
            page: 1,
            pageSize,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            totalWordOccurrences: wordIndexes.length,
            executionTimeMs,
            facets: [
              {
                surahId: surah.id,
                surahNumber: surah.number,
                surahNameArabic: surah.nameArabic,
                surahNameEnglish: surah.nameEnglish,
                count: 1,
              },
            ],
            directReferenceFound: true,
            exactMatchesCount: 1,
            partialMatchesCount: 0,
            pagedItems: [
              {
                id: verse.id,
                surahId: verse.surahId,
                ayahNumber: verse.ayahNumber,
                juzNumber: verse.juzNumber,
                matchedWordIndexes: wordIndexes,
                matchedWordKinds,
                bestMatchKind: 'exact',
                relevanceScore: 100.0,
                matchLevel: 'exact',
                isDirectReference: true,
              },
            ],
          };
        }
      }
    }

    // Filter candidate verses by Surah / Juz
    let candidateVerses = this.verses;
    if (params.surahId) {
      candidateVerses = candidateVerses.filter(
        v => v.surahId === params.surahId || v.surahId === this.surahNumberMap.get(params.surahId!)?.id
      );
    }
    if (params.surahIds) {
      const idList = params.surahIds
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(id => !isNaN(id) && id > 0);
      if (idList.length > 0) {
        candidateVerses = candidateVerses.filter(
          v =>
            idList.includes(v.surahId) ||
            (this.surahMap.get(v.surahId) && idList.includes(this.surahMap.get(v.surahId)!.number))
        );
      }
    }
    if (params.juz && params.juz >= 1 && params.juz <= 30) {
      candidateVerses = candidateVerses.filter(v => v.juzNumber === params.juz);
    }

    // 2. Empty query: browse mode or empty guard
    if (!parsedQuery.hasSearchTerms && !query.trim()) {
      const hasFilter = Boolean(params.surahId || params.surahIds || params.juz);
      const executionTimeMs = Math.round(performance.now() - startTime);

      if (!hasFilter) {
        return {
          pagedItems: [],
          totalCount: 0,
          page: 1,
          pageSize,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          totalWordOccurrences: 0,
          executionTimeMs,
          facets: [],
          directReferenceFound: false,
          exactMatchesCount: 0,
          partialMatchesCount: 0,
        };
      }

      // Explicit browse
      const totalCount = candidateVerses.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIdx = (page - 1) * pageSize;
      const paged = candidateVerses.slice(startIdx, startIdx + pageSize);

      const pagedItems = paged.map(v => ({
        id: v.id,
        surahId: v.surahId,
        ayahNumber: v.ayahNumber,
        juzNumber: v.juzNumber,
        matchedWordIndexes: [],
        matchedWordKinds: {} as Record<number, MatchKind>,
        bestMatchKind: 'exact' as MatchKind,
        relevanceScore: 0.0,
        matchLevel: 'exact',
        isDirectReference: false,
      }));

      return {
        pagedItems,
        totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        totalWordOccurrences: 0,
        executionTimeMs,
        facets: [],
        directReferenceFound: false,
        exactMatchesCount: 0,
        partialMatchesCount: 0,
      };
    }

    // 3. Prepare tokens
    const isRoot = mode === 'root';
    const searchTokens: string[] = [];

    if (parsedQuery.phrases.length > 0) {
      for (const p of parsedQuery.phrases) {
        const norm = getNormalizedToken(p, isRoot, matchBy);
        searchTokens.push(norm);
      }
    }
    for (const w of parsedQuery.words) {
      const norm = getNormalizedToken(w, isRoot, matchBy);
      if (norm) searchTokens.push(norm);
    }

    // Min query length: for smart/partial matching require >= 2 characters
    if (wordMatch !== 'whole' && mode !== 'exact' && searchTokens.some(t => t.length < 2)) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      return {
        pagedItems: [],
        totalCount: 0,
        page: 1,
        pageSize,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        totalWordOccurrences: 0,
        executionTimeMs,
        facets: [],
        directReferenceFound: false,
        exactMatchesCount: 0,
        partialMatchesCount: 0,
        searchHint: 'يرجى إدخال حرفين على الأقل للبحث الذكي أو الجزئي.',
      };
    }

    // Fast candidate verse ID set
    const candidateIds = new Set(candidateVerses.map(v => v.id));

    // Handle Exclusions: -word excludes by whole word only
    const activeSlice = this.getSlice(isRoot, matchBy);
    if (parsedQuery.excludedWords.length > 0) {
      for (const ex of parsedQuery.excludedWords) {
        const exNorm = getNormalizedToken(ex, isRoot, matchBy);
        const exIdx = binarySearchExact(activeSlice.dictionary, exNorm);
        if (exIdx >= 0) {
          const start = activeSlice.wordOffsets[exIdx];
          const end = start + activeSlice.wordLengths[exIdx];
          for (let p = start; p < end; p++) {
            const verseId = activeSlice.packedPostings[p] >>> 8;
            candidateIds.delete(verseId);
          }
        }
      }
    }

    // Check superseded request cancellation
    if (requestId !== undefined && requestId < this.currentRequestId) {
      return null as any;
    }

    // Match tracking structures
    const positionsMap = new Map<number, number[]>();
    const wordKindsMap = new Map<number, Record<number, MatchKind>>();
    const verseBestKind = new Map<number, MatchKind>();
    const verseExactCount = new Map<number, number>();
    const matchLevelsMap = new Map<number, string>();
    let isResultsCapped = false;

    const kindWeight = (k: MatchKind): number => (k === 'exact' ? 3 : k === 'startsWith' ? 2 : 1);

    const recordMatch = (verseId: number, wordIndex: number, kind: MatchKind) => {
      let posList = positionsMap.get(verseId);
      if (!posList) {
        posList = [];
        positionsMap.set(verseId, posList);
        wordKindsMap.set(verseId, {});
      }
      if (!posList.includes(wordIndex)) {
        posList.push(wordIndex);
      }

      const kinds = wordKindsMap.get(verseId)!;
      kinds[wordIndex] = kind;

      const prevBest = verseBestKind.get(verseId);
      if (!prevBest || kindWeight(kind) > kindWeight(prevBest)) {
        verseBestKind.set(verseId, kind);
      }

      if (kind === 'exact') {
        verseExactCount.set(verseId, (verseExactCount.get(verseId) || 0) + 1);
      }

      if (!matchLevelsMap.has(verseId)) {
        matchLevelsMap.set(verseId, matchBy);
      }
    };

    if (mode === 'exact') {
      // Whole Ayah exact match
      const targetQuery = isRoot
        ? toConsonantalSkeleton(query)
        : matchBy === 'exact'
        ? query
        : matchBy === 'spelling'
        ? normalizeArabic(query)
        : toPhonetic(query);

      for (const v of candidateVerses) {
        if (!candidateIds.has(v.id)) continue;
        const vText = isRoot
          ? toConsonantalSkeleton(v.normalizedText)
          : matchBy === 'exact'
          ? v.uthmaniText
          : matchBy === 'spelling'
          ? v.normalizedText
          : toPhonetic(v.uthmaniText);

        if (vText === targetQuery) {
          const vWords = this.verseWordsMap.get(v.id) || [];
          for (const w of vWords) {
            recordMatch(v.id, w.wordIndex, 'exact');
          }
          matchLevelsMap.set(v.id, 'exact');
        }
      }
    } else if (mode === 'any') {
      // Any Word match
      for (const token of searchTokens) {
        const { candidates, isCapped } = this.findCandidateWords(activeSlice, token, wordMatch);
        if (isCapped) isResultsCapped = true;

        for (const cand of candidates) {
          const start = activeSlice.wordOffsets[cand.dictIndex];
          const end = start + activeSlice.wordLengths[cand.dictIndex];
          for (let p = start; p < end; p++) {
            const packed = activeSlice.packedPostings[p];
            const verseId = packed >>> 8;
            if (!candidateIds.has(verseId)) continue;
            const wordIndex = packed & 0xff;
            recordMatch(verseId, wordIndex, cand.kind);
          }
        }
      }
    } else {
      // 'phrase' or 'all'
      const isPhrase = mode === 'phrase';
      const tokenList =
        searchTokens.length === 1 && searchTokens[0].includes(' ')
          ? searchTokens[0].split(' ').filter(Boolean)
          : searchTokens;

      if (tokenList.length === 1) {
        // Single word search
        const { candidates, isCapped } = this.findCandidateWords(activeSlice, tokenList[0], wordMatch);
        if (isCapped) isResultsCapped = true;

        for (const cand of candidates) {
          const start = activeSlice.wordOffsets[cand.dictIndex];
          const end = start + activeSlice.wordLengths[cand.dictIndex];
          for (let p = start; p < end; p++) {
            const packed = activeSlice.packedPostings[p];
            const verseId = packed >>> 8;
            if (!candidateIds.has(verseId)) continue;
            const wordIndex = packed & 0xff;
            recordMatch(verseId, wordIndex, cand.kind);
          }
        }
      } else if (tokenList.length > 1) {
        // Multi-word phrase or all-words
        interface TokenPostingWithKind {
          verseId: number;
          wordIndex: number;
          kind: MatchKind;
        }

        const tokenPostingsMap: TokenPostingWithKind[][] = [];
        for (const token of tokenList) {
          const { candidates, isCapped } = this.findCandidateWords(activeSlice, token, wordMatch);
          if (isCapped) isResultsCapped = true;

          const postingsWithKind: TokenPostingWithKind[] = [];
          for (const cand of candidates) {
            const start = activeSlice.wordOffsets[cand.dictIndex];
            const end = start + activeSlice.wordLengths[cand.dictIndex];
            for (let p = start; p < end; p++) {
              const packed = activeSlice.packedPostings[p];
              const verseId = packed >>> 8;
              if (candidateIds.has(verseId)) {
                postingsWithKind.push({
                  verseId,
                  wordIndex: packed & 0xff,
                  kind: cand.kind,
                });
              }
            }
          }
          tokenPostingsMap.push(postingsWithKind);
        }

        // Group by verseId sparsely (only for verses containing query tokens)
        const verseOccurrences = new Map<number, TokenPostingWithKind[][]>();

        for (let tIdx = 0; tIdx < tokenPostingsMap.length; tIdx++) {
          for (const p of tokenPostingsMap[tIdx]) {
            let arr = verseOccurrences.get(p.verseId);
            if (!arr) {
              arr = Array.from({ length: tokenList.length }, () => []);
              verseOccurrences.set(p.verseId, arr);
            }
            arr[tIdx].push(p);
          }
        }

        for (const [verseId, tokenMatches] of verseOccurrences.entries()) {
          let hasAll = true;
          for (let i = 0; i < tokenList.length; i++) {
            if (tokenMatches[i].length === 0) {
              hasAll = false;
              break;
            }
          }
          if (hasAll) {
            if (isPhrase) {
              // Consecutive sequence: pos_i+1 == pos_i + 1
              for (const first of tokenMatches[0]) {
                let matchesSequence = true;
                const seq = [first];
                for (let step = 1; step < tokenList.length; step++) {
                  const expectedPos = first.wordIndex + step;
                  const match = tokenMatches[step].find(p => p.wordIndex === expectedPos);
                  if (match) {
                    seq.push(match);
                  } else {
                    matchesSequence = false;
                    break;
                  }
                }
                if (matchesSequence) {
                  for (const m of seq) {
                    recordMatch(verseId, m.wordIndex, m.kind);
                  }
                }
              }
            } else {
              // 'all' mode: all tokens present anywhere
              for (const list of tokenMatches) {
                for (const m of list) {
                  recordMatch(verseId, m.wordIndex, m.kind);
                }
              }
            }
          }
        }
      }
    }

    // Build Results
    const matchedVerseIds = Array.from(positionsMap.keys());
    let results: VerseSearchResult[] = [];
    let totalWordOccurrences = 0;
    let exactMatchesCount = 0;
    let partialMatchesCount = 0;

    for (const vId of matchedVerseIds) {
      const verse = this.verseMap.get(vId)!;
      const surah = this.surahMap.get(verse.surahId)!;
      const positions = positionsMap.get(vId) || [];
      const matchCount = positions.length;
      totalWordOccurrences += matchCount;

      const kinds = wordKindsMap.get(vId) || {};
      const bestKind = verseBestKind.get(vId) || 'contains';

      if (bestKind === 'exact') {
        exactMatchesCount++;
      } else {
        partialMatchesCount++;
      }

      const exactCount = verseExactCount.get(vId) || 0;
      const kindScore = bestKind === 'exact' ? 30000 : bestKind === 'startsWith' ? 20000 : 10000;
      const relevanceScore = kindScore + exactCount * 1000 + matchCount * 100;

      const surahId = this.verseSurahIds[vId];
      const ayahNumber = this.verseAyahNumbers[vId];
      const juzNumber = this.verseJuzNumbers[vId];
      const v = this.verseMap.get(vId);

      results.push({
        id: vId,
        surahId,
        ayahNumber,
        juzNumber,
        surahNameArabic: '',
        surahNameEnglish: '',
        uthmaniText: v?.uthmaniText || '',
        normalizedText: '',
        matchedWordIndexes: positions.sort((a, b) => a - b),
        matchCount,
        relevanceScore,
        isDirectReference: false,
        matchLevel: (matchLevelsMap.get(vId) as 'phonetic' | 'spelling' | 'exact') || 'phonetic',
        matchedWordKinds: kinds,
        bestMatchKind: bestKind,
      });
    }

    // Facets calculation
    const facetCounts = new Map<number, number>();
    for (const r of results) {
      facetCounts.set(r.surahId, (facetCounts.get(r.surahId) || 0) + 1);
    }
    const facets: SurahFacet[] = Array.from(facetCounts.entries())
      .map(([sId, count]) => {
        const s = this.surahMap.get(sId);
        return {
          surahId: sId,
          surahNumber: s?.number || sId,
          surahNameArabic: s?.nameArabic || '',
          surahNameEnglish: s?.nameEnglish || '',
          count,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Sorting
    if (sort === 'relevance') {
      results.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) || a.id - b.id);
    } else if (sort === 'surah') {
      results.sort((a, b) => a.surahId - b.surahId || a.ayahNumber - b.ayahNumber);
    } else if (sort === 'ayahLength') {
      results.sort((a, b) => a.uthmaniText.length - b.uthmaniText.length || a.id - b.id);
    } else {
      // 'mushaf'
      results.sort((a, b) => a.id - b.id);
    }

    const totalCount = results.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIdx = (page - 1) * pageSize;
    const pagedMatches = results.slice(startIdx, startIdx + pageSize);

    const pagedItems = pagedMatches.map(m => ({
      id: m.id,
      surahId: m.surahId,
      ayahNumber: m.ayahNumber,
      juzNumber: m.juzNumber || 1,
      matchedWordIndexes: m.matchedWordIndexes || [],
      matchedWordKinds: (m.matchedWordKinds as Record<number, MatchKind>) || {},
      bestMatchKind: (m.bestMatchKind as MatchKind) || 'contains',
      relevanceScore: m.relevanceScore || 0,
      matchLevel: m.matchLevel || 'phonetic',
      isDirectReference: false,
    }));

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      totalCount,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      totalWordOccurrences,
      executionTimeMs,
      facets,
      directReferenceFound: false,
      exactMatchesCount,
      partialMatchesCount,
      searchHint: isResultsCapped ? 'نتائج كثيرة، أضف حرفاً لتضييق البحث.' : undefined,
      pagedItems,
    };
  }

  /**
   * Hydrates lightweight compact search results with full verse texts and surah names
   */
  public hydrateCompactResults(compact: CompactSearchResultPayload): QuranSearchResponse {
    const items: VerseSearchResult[] = compact.pagedItems.map(item => {
      const verse = this.verseMap.get(item.id);
      const surah = this.surahMap.get(item.surahId);
      return {
        id: item.id,
        surahId: item.surahId,
        ayahNumber: item.ayahNumber,
        juzNumber: item.juzNumber,
        surahNameArabic: surah?.nameArabic || '',
        surahNameEnglish: surah?.nameEnglish || '',
        uthmaniText: verse?.uthmaniText || '',
        normalizedText: verse?.normalizedText || '',
        matchedWordIndexes: item.matchedWordIndexes,
        matchCount: item.matchedWordIndexes.length,
        relevanceScore: item.relevanceScore,
        isDirectReference: item.isDirectReference ?? false,
        matchLevel: (item.matchLevel as any) || 'phonetic',
        matchedWordKinds: item.matchedWordKinds,
        bestMatchKind: item.bestMatchKind,
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

  /**
   * Full search pipeline matching localSearchEngine contract byte-for-byte
   */
  public search(
    params: {
      q?: string | null;
      surahId?: number;
      surahIds?: string;
      juz?: number;
      mode?: SearchMode;
      wordMatch?: 'smart' | 'whole' | 'partial' | 'exact';
      matchBy?: MatchBasis;
      diacritics?: boolean;
      sort?: SortOption;
      page?: number;
      pageSize?: number;
    },
    requestId?: number
  ): QuranSearchResponse {
    const compact = this.searchCompact(params, requestId);
    return this.hydrateCompactResults(compact);
  }

  public getVerseContext(verseId: number, before: number = 1, after: number = 1) {
    const target = this.verseMap.get(verseId);
    if (!target) return null;

    const surah = this.surahMap.get(target.surahId)!;
    const targetDto = {
      id: target.id,
      surahId: target.surahId,
      ayahNumber: target.ayahNumber,
      juzNumber: target.juzNumber,
      surahNameArabic: surah?.nameArabic || '',
      surahNameEnglish: surah?.nameEnglish || '',
      uthmaniText: target.uthmaniText,
      normalizedText: target.normalizedText,
      consonantalSkeleton: target.consonantalSkeleton,
    };

    const beforeVerses = this.verses
      .filter(
        v =>
          v.surahId === target.surahId &&
          v.ayahNumber < target.ayahNumber &&
          v.ayahNumber >= target.ayahNumber - before
      )
      .map(v => ({
        id: v.id,
        surahId: v.surahId,
        ayahNumber: v.ayahNumber,
        juzNumber: v.juzNumber,
        surahNameArabic: surah?.nameArabic || '',
        surahNameEnglish: surah?.nameEnglish || '',
        uthmaniText: v.uthmaniText,
        normalizedText: v.normalizedText,
        consonantalSkeleton: v.consonantalSkeleton,
      }))
      .sort((a, b) => a.ayahNumber - b.ayahNumber);

    const afterVerses = this.verses
      .filter(
        v =>
          v.surahId === target.surahId &&
          v.ayahNumber > target.ayahNumber &&
          v.ayahNumber <= target.ayahNumber + after
      )
      .map(v => ({
        id: v.id,
        surahId: v.surahId,
        ayahNumber: v.ayahNumber,
        juzNumber: v.juzNumber,
        surahNameArabic: surah?.nameArabic || '',
        surahNameEnglish: surah?.nameEnglish || '',
        uthmaniText: v.uthmaniText,
        normalizedText: v.normalizedText,
        consonantalSkeleton: v.consonantalSkeleton,
      }))
      .sort((a, b) => a.ayahNumber - b.ayahNumber);

    return {
      targetVerse: targetDto,
      beforeVerses,
      afterVerses,
    };
  }
}
