import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { QuranSearchResponse, SearchMode, MatchBasis, SortOption } from '@/types/quran';
import { useDataset } from '@/context/DatasetContext';
import { searchLocalWorker } from '@/offline/searchWorkerClient';

export interface QuranSearchParams {
  q?: string;
  surahId?: number;
  juz?: number;
  mode?: SearchMode;
  matchBy?: MatchBasis;
  wordMatch?: 'smart' | 'whole' | 'partial' | 'exact';
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useQuranSearch(params: QuranSearchParams) {
  const { isOfflineReady, isOffline } = useDataset();

  const trimmedQuery = params.q?.trim() || '';
  const isDirectRef = /^\d+:\d+$/.test(trimmedQuery);
  const hasFilterActive = Boolean(params.surahId || params.juz);
  const isQueryExecutable = trimmedQuery.length >= 2 || isDirectRef || (hasFilterActive && trimmedQuery.length > 0);
  const isBrowseMode = hasFilterActive && trimmedQuery.length === 0;
  const isSearchActive = (isQueryExecutable || isBrowseMode) && (params.enabled !== false);

  const isLocalSource = isOfflineReady;
  const activeWordMatch = params.wordMatch || 'smart';
  const activeSort = params.sort || (activeWordMatch === 'smart' ? 'relevance' : 'mushaf');

  return useQuery<QuranSearchResponse>({
    queryKey: [
      'quranSearch',
      isLocalSource ? 'local' : 'remote',
      trimmedQuery,
      params.surahId,
      params.juz,
      params.mode || 'phrase',
      params.matchBy || 'phonetic',
      activeWordMatch,
      activeSort,
      params.page || 1,
      params.pageSize || 20,
    ],
    queryFn: async ({ signal }) => {
      // 1. If local dataset is loaded into IndexedDB & Web Worker, search locally
      if (isLocalSource) {
        try {
          return await searchLocalWorker({
            q: trimmedQuery,
            surahId: params.surahId,
            juz: params.juz,
            mode: params.mode,
            matchBy: params.matchBy,
            wordMatch: activeWordMatch,
            sort: activeSort,
            page: params.page,
            pageSize: params.pageSize || 20,
          });
        } catch (err) {
          console.warn('Local worker search fallback to API:', err);
          if (isOffline) throw err;
        }
      }

      // 2. Remote API fallback
      const searchParams = new URLSearchParams();
      if (trimmedQuery) searchParams.append('q', trimmedQuery);
      if (params.surahId) searchParams.append('surahId', params.surahId.toString());
      if (params.juz) searchParams.append('juz', params.juz.toString());
      if (params.mode && params.mode !== 'phrase') searchParams.append('mode', params.mode);
      if (params.matchBy && params.matchBy !== 'phonetic') searchParams.append('matchBy', params.matchBy);
      if (activeWordMatch !== 'smart') searchParams.append('wordMatch', activeWordMatch);
      if (activeSort !== 'mushaf') searchParams.append('sort', activeSort);
      searchParams.append('page', (params.page || 1).toString());
      searchParams.append('pageSize', (params.pageSize || 20).toString());

      const res = await api.get<QuranSearchResponse>(`/quran/search?${searchParams.toString()}`, { signal });
      return res.data;
    },
    enabled: isSearchActive,
    placeholderData: keepPreviousData,
  });
}

