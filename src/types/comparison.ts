export interface ComparisonVerse {
  id: string;
  comparisonId: string;
  quranVerseId: number;
  surahNumber: number;
  surahNameArabic: string;
  ayahNumber: number;
  uthmaniText: string;
}

export interface VerseDifference {
  id: string;
  comparisonId: string;
  quranVerseId: number;
  startPosition?: number;
  endPosition?: number;
  selectedText: string;
  explanation: string;
  surahNumber: number;
  surahNameArabic: string;
  ayahNumber: number;
}

export interface VerseComparison {
  id: string;
  collectionId: string;
  title: string;
  description?: string;
  sharedPhrases?: string;
  createdAt: string;
  updatedAt: string;
  verses: ComparisonVerse[];
  differences: VerseDifference[];
}

export interface CreateComparisonPayload {
  title: string;
  description?: string;
  sharedPhrases?: string;
  quranVerseIds?: number[];
}

export interface UpdateComparisonPayload {
  title: string;
  description?: string;
  sharedPhrases?: string;
  quranVerseIds?: number[];
}

export interface CreateDifferencePayload {
  quranVerseId: number;
  startPosition?: number;
  endPosition?: number;
  selectedText: string;
  explanation: string;
}

export interface UpdateDifferencePayload {
  startPosition?: number;
  endPosition?: number;
  selectedText: string;
  explanation: string;
}

