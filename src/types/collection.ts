import { VerseComparison } from './comparison';
import { MemorizationConnection } from './connection';
import { PersonalNote } from './note';

export interface CollectionSummary {
  id: string;
  title: string;
  description?: string;
  verseCount: number;
  comparisonCount: number;
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
  surahNames?: string[];
  baseSurahId?: number;
  baseSurahNameArabic?: string;
}

export interface CollectionVerse {
  id: string;
  collectionId: string;
  quranVerseId: number;
  displayOrder: number;
  personalNote?: string;
  addedAt: string;
  surahId: number;
  surahNumber: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  ayahNumber: number;
  uthmaniText: string;
}

export interface CollectionDetail {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  verses: CollectionVerse[];
  comparisons: VerseComparison[];
  connections: MemorizationConnection[];
  notes: PersonalNote[];
  baseSurahId?: number;
  baseSurahNameArabic?: string;
}

export interface CreateCollectionPayload {
  title: string;
  description?: string;
  quranVerseIds?: number[];
  baseSurahId?: number;
}

export interface UpdateCollectionPayload {
  title: string;
  description?: string;
  baseSurahId?: number;
}

export interface DashboardStats {
  totalCollections: number;
  totalSavedVerses: number;
  totalComparisons: number;
  totalConnections: number;
  recentCollections: CollectionSummary[];
}

