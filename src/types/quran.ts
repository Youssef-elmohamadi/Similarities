export interface Surah {
  id: number;
  number: number;
  nameArabic: string;
  nameEnglish: string;
  englishTranslation?: string;
  ayahCount: number;
  revelationType: string;
  bismillahText?: string | null;
}

export interface QuranVerse {
  id: number;
  surahId: number;
  ayahNumber: number;
  juzNumber?: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  uthmaniText: string;
  normalizedText: string;
}

export interface VerseSearchResult {
  id: number;
  surahId: number;
  ayahNumber: number;
  juzNumber?: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  uthmaniText: string;
  normalizedText: string;
  matchedWordIndexes?: number[];
  matchCount?: number;
  relevanceScore?: number;
  isDirectReference?: boolean;
  matchLevel?: 'phonetic' | 'spelling' | 'exact';
  highlightedSnippet?: string;
}

export interface SurahFacet {
  surahId: number;
  surahNumber: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  count: number;
}

export interface QuranSearchResponse {
  items: VerseSearchResult[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalWordOccurrences: number;
  executionTimeMs: number;
  facets: SurahFacet[];
  directReferenceFound?: boolean;
}

export interface VerseContext {
  targetVerse: QuranVerse;
  beforeVerses: QuranVerse[];
  afterVerses: QuranVerse[];
}

export interface WordOccurrenceItem {
  originalWord: string;
  normalizedWord: string;
  skeletonWord: string;
  count: number;
}

export type SearchMode = 'phrase' | 'all' | 'any' | 'exact' | 'prefix' | 'contains' | 'root';
export type MatchBasis = 'phonetic' | 'spelling' | 'exact';
export type SortOption = 'mushaf' | 'relevance' | 'surah' | 'ayahLength';

export interface QuranSearchParams {
  q?: string;
  surahId?: number;
  surahIds?: string;
  juz?: number;
  mode?: SearchMode;
  matchBy?: MatchBasis;
  diacritics?: boolean;
  wordMatch?: 'exact' | 'partial';
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

