import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  isOfflineDatasetAvailable,
  getVersesBySurahId,
  getSurahById,
} from '@/offline/quranDb';

export interface ResolvedVerse {
  id: number;
  surahNumber: number;
  ayahNumber: number;
  surahNameArabic: string;
  uthmaniText: string;
}

export function useVerseLookup(surahNumber: number, ayahNumber: number) {
  return useQuery<ResolvedVerse | null>({
    queryKey: ['verse-lookup', surahNumber, ayahNumber],
    queryFn: async () => {
      // 1. Check local IndexedDB dataset first
      try {
        const isOffline = await isOfflineDatasetAvailable();
        if (isOffline) {
          const surah = await getSurahById(surahNumber);
          const verses = await getVersesBySurahId(surahNumber);
          const matched = verses.find((v) => v.ayahNumber === ayahNumber);
          if (matched) {
            return {
              id: matched.id,
              surahNumber,
              ayahNumber,
              surahNameArabic: surah?.nameArabic || `سورة ${surahNumber}`,
              uthmaniText: matched.uthmaniText,
            };
          }
        }
      } catch {
        // Fall back to API
      }

      // 2. Fetch from API if not local
      try {
        const res = await api.get<any[]>(`/quran/surahs/${surahNumber}/verses`);
        const verses = res.data || [];
        const matched = verses.find((v) => v.ayahNumber === ayahNumber);
        if (matched) {
          return {
            id: matched.id,
            surahNumber,
            ayahNumber,
            surahNameArabic: matched.surahNameArabic || `سورة ${surahNumber}`,
            uthmaniText: matched.uthmaniText,
          };
        }
      } catch {
        // Handled
      }

      return null;
    },
    staleTime: Infinity,
    networkMode: 'offlineFirst',
    enabled: surahNumber > 0 && ayahNumber > 0,
  });
}

