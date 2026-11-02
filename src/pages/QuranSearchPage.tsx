import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Surah,
  QuranVerse,
  QuranSearchResponse,
  VerseSearchResult,
  SearchMode,
  MatchBasis,
  SortOption,
} from '@/types/quran';
import { VerseCard } from '@/components/quran/VerseCard';
import { VerseSelectionBar } from '@/components/quran/VerseSelectionBar';
import { VersePreviewModal } from '@/components/quran/VersePreviewModal';
import { WordOccurrencesView } from '@/components/quran/WordOccurrencesView';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { VerseCardSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import {
  Search,
  X,
  SlidersHorizontal,
  RotateCcw,
  Clock,
  Sparkles,
  BookOpen,
  ListFilter,
  CheckSquare,
  Square,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDataset } from '@/context/DatasetContext';
import { useQuranSearch } from '@/hooks/useQuranSearch';
import { toArabicDigits } from '@/lib/utils';
import { useToast } from '@/components/common/Toast';

const RECENT_SEARCHES_KEY = 'quran_recent_searches';
const SEARCH_OPTIONS_KEY = 'quran_search_options';

interface StoredSearchOptions {
  mode: SearchMode;
  matchBy: MatchBasis;
  diacritics?: boolean;
  wordMatch: 'smart' | 'whole' | 'partial';
  sort: SortOption;
}

const defaultOptions: StoredSearchOptions = {
  mode: 'phrase',
  matchBy: 'phonetic',
  wordMatch: 'smart',
  sort: 'relevance',
};

export const QuranSearchPage: React.FC = () => {
  const { t, direction } = useLanguage();
  const { isOfflineReady, isOffline } = useDataset();
  const isRtl = direction === 'rtl';
  const navigate = useNavigate();
  const toast = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL params
  const queryParam = searchParams.get('q') || '';
  const surahParam = searchParams.get('surah') ? Number(searchParams.get('surah')) : undefined;
  const juzParam = searchParams.get('juz') ? Number(searchParams.get('juz')) : undefined;
  const modeParam = (searchParams.get('mode') as SearchMode) || 'phrase';
  const matchByParam = (searchParams.get('matchBy') as MatchBasis) ||
    (searchParams.get('diacritics') === 'true' ? 'exact' : 'phonetic');
  const rawWordMatch = searchParams.get('wordMatch');
  const wordMatchParam: 'smart' | 'whole' | 'partial' =
    rawWordMatch === 'exact' ? 'whole' :
    (rawWordMatch === 'whole' || rawWordMatch === 'partial' || rawWordMatch === 'smart') ? rawWordMatch : 'smart';
  const rawSort = searchParams.get('sort');
  const sortParam: SortOption = (rawSort as SortOption) || (wordMatchParam === 'smart' ? 'relevance' : 'mushaf');
  const pageParam = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  // Local states
  const [searchInput, setSearchInput] = useState(queryParam);
  const [selectedSurahId, setSelectedSurahId] = useState<number | undefined>(surahParam);
  const [selectedJuz, setSelectedJuz] = useState<number | undefined>(juzParam);
  const [searchMode, setSearchMode] = useState<SearchMode>(modeParam);
  const [matchBy, setMatchBy] = useState<MatchBasis>(matchByParam);
  const [wordMatch, setWordMatch] = useState<'smart' | 'whole' | 'partial'>(wordMatchParam);
  const [sortOption, setSortOption] = useState<SortOption>(sortParam);
  const [page, setPage] = useState(pageParam);

  const isComposingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedQueryRef = useRef<string>('');

  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [showTipsPopover, setShowTipsPopover] = useState(false);
  const [isSelectMenuOpen, setIsSelectMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'verses' | 'words'>('verses');

  const [selectedVerses, setSelectedVerses] = useState<QuranVerse[]>([]);
  const [previewVerse, setPreviewVerse] = useState<QuranVerse | null>(null);

  // Recent Searches state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Load stored preferences if not set in URL
  useEffect(() => {
    if (!searchParams.get('mode') && !searchParams.get('matchBy')) {
      try {
        const stored = localStorage.getItem(SEARCH_OPTIONS_KEY);
        if (stored) {
          const parsed: StoredSearchOptions = JSON.parse(stored);
          if (parsed.mode) setSearchMode(parsed.mode);
          if (parsed.matchBy) setMatchBy(parsed.matchBy);
          else if (parsed.diacritics) setMatchBy('exact');
          if (parsed.wordMatch) setWordMatch(parsed.wordMatch);
          if (parsed.sort) setSortOption(parsed.sort);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Sync state when URL params change
  useEffect(() => {
    setSearchInput(queryParam);
    setSelectedSurahId(surahParam);
    setSelectedJuz(juzParam);
    setSearchMode(modeParam);
    setMatchBy(matchByParam);
    setWordMatch(wordMatchParam);
    setSortOption(sortParam);
    setPage(pageParam);
  }, [
    queryParam,
    surahParam,
    juzParam,
    modeParam,
    matchByParam,
    wordMatchParam,
    sortParam,
    pageParam,
  ]);

  // Global Keyboard shortcuts (/ to focus search, Esc to blur)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save search query to recent searches
  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, queryToRemove: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== queryToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const clearAllRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Helpers to test if query or filter is active
  const isDirectRef = /^\d+:\d+$/.test(queryParam.trim());
  const hasFilterActive = Boolean(surahParam || juzParam);
  const isQueryExecutable = queryParam.trim().length >= 2 || isDirectRef || (hasFilterActive && queryParam.trim().length > 0);
  const isBrowseMode = hasFilterActive && queryParam.trim().length === 0;
  const isSearchActive = isQueryExecutable || isBrowseMode;

  // Single character warning (when typing 1 char and no surah/juz filter)
  const isSingleCharQuery = searchInput.trim().length === 1 && !isDirectRef && !selectedSurahId && !selectedJuz;

  // Load Surahs for the filter dropdown
  const { data: surahs } = useQuery<Surah[]>({
    queryKey: ['surahs'],
    queryFn: async () => {
      const res = await api.get<Surah[]>('/quran/surahs');
      return res.data;
    },
    staleTime: 1000 * 60 * 60,
  });

  // Query verses using unified useQuranSearch (local offline worker when available, fallback to remote API)
  const { data: searchResponse, isLoading, isFetching } = useQuranSearch({
    q: queryParam,
    surahId: surahParam,
    juz: juzParam,
    mode: modeParam,
    matchBy: matchByParam,
    wordMatch: wordMatchParam,
    sort: sortParam,
    page,
    pageSize: 20,
    enabled: isSearchActive,
  });

  // Record to recent searches only after query has been stable for ~1.5s and returned results
  useEffect(() => {
    if (
      searchResponse &&
      searchResponse.items.length > 0 &&
      queryParam.trim().length >= 2 &&
      lastRecordedQueryRef.current !== queryParam.trim()
    ) {
      const timer = setTimeout(() => {
        saveRecentSearch(queryParam.trim());
        lastRecordedQueryRef.current = queryParam.trim();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchResponse, queryParam]);

  const updateUrl = useCallback(
    (
      overrides: Partial<{
        q: string;
        surah: number | undefined;
        juz: number | undefined;
        mode: SearchMode;
        matchBy: MatchBasis;
        wordMatch: 'smart' | 'whole' | 'partial';
        sort: SortOption;
        page: number;
      }>,
      replace: boolean = false
    ) => {
      const q = overrides.q !== undefined ? overrides.q : searchInput.trim();
      const surah = overrides.surah !== undefined ? overrides.surah : selectedSurahId;
      const juz = overrides.juz !== undefined ? overrides.juz : selectedJuz;
      const mode = overrides.mode !== undefined ? overrides.mode : searchMode;
      const mb = overrides.matchBy !== undefined ? overrides.matchBy : matchBy;
      const wm = overrides.wordMatch !== undefined ? overrides.wordMatch : wordMatch;
      const s = overrides.sort !== undefined ? overrides.sort : sortOption;
      const p = overrides.page !== undefined ? overrides.page : 1;

      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (surah) params.set('surah', surah.toString());
      if (juz) params.set('juz', juz.toString());
      if (mode && mode !== 'phrase') params.set('mode', mode);
      if (mb && mb !== 'phonetic') params.set('matchBy', mb);
      if (wm && wm !== 'smart') params.set('wordMatch', wm);
      if (s && ((wm === 'smart' && s !== 'relevance') || (wm !== 'smart' && s !== 'mushaf'))) {
        params.set('sort', s);
      }
      if (p > 1) params.set('page', p.toString());

      setSearchParams(params, { replace });

      // Persist user preference for options
      try {
        localStorage.setItem(
          SEARCH_OPTIONS_KEY,
          JSON.stringify({ mode, matchBy: mb, wordMatch: wm, sort: s })
        );
      } catch {
        // ignore
      }
    },
    [searchInput, selectedSurahId, selectedJuz, searchMode, matchBy, wordMatch, sortOption, setSearchParams]
  );

  // Instant Debounce Search handler
  const scheduleDebouncedSearch = useCallback(
    (newText: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (historyPushTimerRef.current) {
        clearTimeout(historyPushTimerRef.current);
      }

      const trimmed = newText.trim();

      // If empty: clear immediately, sync replaceState to idle
      if (!trimmed) {
        updateUrl({ q: '', page: 1 }, true);
        return;
      }

      // If direct reference (e.g. 2:255) or filter active: execute immediately or after short debounce
      const isRef = /^\d+:\d+$/.test(trimmed);
      if (trimmed.length < 2 && !isRef && !selectedSurahId && !selectedJuz) {
        // Under 2 chars: do not search yet, but update url replaceState
        updateUrl({ q: trimmed, page: 1 }, true);
        return;
      }

      // 250ms debounce for typing with replaceState
      debounceTimerRef.current = setTimeout(() => {
        updateUrl({ q: trimmed, page: 1 }, true);

        // After settling for 1.2s, promote to pushState in browser history
        historyPushTimerRef.current = setTimeout(() => {
          updateUrl({ q: trimmed, page: 1 }, false);
        }, 1200);
      }, 250);
    },
    [updateUrl, selectedSurahId, selectedJuz]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (!isComposingRef.current) {
      scheduleDebouncedSearch(val);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    scheduleDebouncedSearch(e.currentTarget.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (historyPushTimerRef.current) {
      clearTimeout(historyPushTimerRef.current);
    }
    const trimmed = searchInput.trim();
    if (trimmed.length >= 2 || /^\d+:\d+$/.test(trimmed) || selectedSurahId || selectedJuz) {
      updateUrl({ q: trimmed, page: 1 }, false);
    }
  };

  const handleClearInput = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (historyPushTimerRef.current) clearTimeout(historyPushTimerRef.current);
    setSearchInput('');
    updateUrl({ q: '', page: 1 }, true);
    searchInputRef.current?.focus();
  };

  const handleSurahFacetClick = (surahId?: number) => {
    setSelectedSurahId(surahId);
    updateUrl({ surah: surahId, page: 1 });
  };

  const handleResetOptions = () => {
    setSearchMode('phrase');
    setMatchBy('phonetic');
    setWordMatch('smart');
    setSortOption('relevance');
    setSelectedJuz(undefined);
    updateUrl({
      mode: 'phrase',
      matchBy: 'phonetic',
      wordMatch: 'smart',
      sort: 'relevance',
      juz: undefined,
      page: 1,
    });
    toast.info(t('تمت إعادة ضبط خيارات البحث', 'Search options reset'));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSelect = (verse: QuranVerse) => {
    setSelectedVerses(prev => {
      const exists = prev.some(v => v.id === verse.id);
      if (exists) {
        return prev.filter(v => v.id !== verse.id);
      } else {
        return [...prev, verse];
      }
    });
  };

  const handleSelectPage = () => {
    if (!searchResponse?.items) return;
    setSelectedVerses(prev => {
      const newItems = searchResponse.items.filter(item => !prev.some(v => v.id === item.id));
      return [...prev, ...newItems];
    });
    toast.success(t('تم تحديد جميع آيات الصفحة الحالية', 'Current page verses selected'));
  };

  const handleSelectAllCapped = async () => {
    if (!searchResponse) return;
    try {
      // Fetch up to 200 verses for current query
      const params = new URLSearchParams();
      if (queryParam) params.append('q', queryParam);
      if (surahParam) params.append('surahId', surahParam.toString());
      if (juzParam) params.append('juz', juzParam.toString());
      if (modeParam && modeParam !== 'phrase') params.append('mode', modeParam);
      if (matchByParam && matchByParam !== 'phonetic') params.append('matchBy', matchByParam);
      if (wordMatchParam === 'partial') params.append('wordMatch', 'partial');
      params.append('page', '1');
      params.append('pageSize', '200');

      const res = await api.get<QuranSearchResponse>(`/quran/search?${params.toString()}`);
      setSelectedVerses(res.data.items);
      toast.success(
        t(
          `تم تحديد ${res.data.items.length} آية (الحد الأقصى للمجموعة 200)`,
          `Selected ${res.data.items.length} verses (max 200)`
        )
      );
    } catch {
      toast.error(t('تعذر تحديد جميع الآيات', 'Failed to select all verses'));
    }
  };

  const handleCreateCollection = () => {
    if (selectedVerses.length === 0) return;
    const verseIds = selectedVerses.map(v => v.id).join(',');
    navigate(`/collections/new?verses=${verseIds}`);
  };

  const handleClearSelection = () => {
    setSelectedVerses([]);
  };

  const isCurrentPageAllSelected =
    searchResponse?.items &&
    searchResponse.items.length > 0 &&
    searchResponse.items.every(item => selectedVerses.some(v => v.id === item.id));

  return (
    <div className="space-y-4 md:space-y-6 pb-24 text-start animate-fade-in">
      {/* Search Header - Compact on mobile, standard on desktop */}
      <div className="flex items-center justify-between gap-3 py-1 md:py-2 border-b border-border/60">
        <div className="space-y-0.5 md:space-y-1 text-start min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-text-primary leading-tight truncate">
              {t('محرك البحث القرآني المتطور', 'Advanced Quran Search Engine')}
            </h1>

            {/* Offline Local Engine Badge */}
            {isOfflineReady && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-primary-tint text-primary border border-primary/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>{isOffline ? t('يعمل بدون إنترنت', 'Offline Mode') : t('محرك محلي فائق السرعة', 'Local Engine')}</span>
              </span>
            )}

            {/* Search Tips Popover Toggle on Mobile */}
            <button
              type="button"
              onClick={() => setShowTipsPopover(!showTipsPopover)}
              aria-label={t('تعليمات البحث', 'Search Tips')}
              className="md:hidden text-text-secondary hover:text-primary p-1 rounded-md transition shrink-0"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          <p className="hidden md:block text-sm text-text-secondary leading-relaxed max-w-3xl">
            {t(
              'بحث دقيق في نص المصحف الشريف بالرسم العثماني، يدعم العبارات المتتالية، المتشابهات الإملائية، والبحث الجذري بالأجزاء والسور.',
              'High-precision Quran search engine with Uthmani orthography, phrase sequences, spelling variants, and root indexing.'
            )}
          </p>
        </div>

        {/* Desktop search tips indicator */}
        <button
          type="button"
          onClick={() => setShowTipsPopover(!showTipsPopover)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface border border-border transition shrink-0"
        >
          <Info className="w-4 h-4 text-primary" />
          <span>{t('إرشادات البحث', 'Search Tips')}</span>
        </button>
      </div>

      {/* Search Tips Popover / Modal */}
      {showTipsPopover && (
        <div className="bg-surface p-4 rounded-xl border border-primary/30 shadow-sm text-xs text-text-secondary space-y-2 animate-fade-in">
          <div className="flex items-center justify-between font-semibold text-text-primary pb-1 border-b border-border">
            <span className="flex items-center gap-1.5 text-primary">
              <Sparkles className="w-4 h-4 text-accent" />
              {t('إرشادات وصيغ البحث القرآني الذكي', 'Smart Quran Search Guidelines')}
            </span>
            <button
              type="button"
              onClick={() => setShowTipsPopover(false)}
              className="p-1 text-text-secondary hover:text-text-primary rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="leading-relaxed text-text-primary">
            {t(
              'بحث دقيق في نص المصحف الشريف بالرسم العثماني، يدعم العبارات المتتالية، المتشابهات الإملائية، والبحث الجذري بالأجزاء والسور.',
              'High-precision Quran search engine with Uthmani orthography, phrase sequences, spelling variants, and root indexing.'
            )}
          </p>
          <ul className="list-disc list-inside space-y-1 text-text-secondary">
            <li>{t('البحث بمرجع الآية مباشرة: مثل 2:255 أو 1:1', 'Search directly by reference: e.g. 2:255 or 1:1')}</li>
            <li>{t('البحث باللفظ (الافتراضي): مثل "يسيرو" يطابق "يَسِيرُوا۟"', 'Phonetic search: e.g. "يسيرو" matches "يَسِيرُوا۟"')}</li>
            <li>{t('استبعاد كلمات باستخدام علامة السالب: مثل "الله -العالمين"', 'Exclude terms using minus: e.g. "الله -العالمين"')}</li>
            <li>{t('البحث بعبارة متتالية دقيقة بين علامتي تنصيص: "جنات تجري"', 'Exact phrase in quotes: "جنات تجري"')}</li>
          </ul>
        </div>
      )}

      {/* Main Search Input & Top Controls - Sticky below mobile header (56px) and desktop header (64px) */}
      <div className="sticky top-14 md:top-16 z-20 space-y-2 bg-background/95 backdrop-blur-md pt-1 pb-2 border-b border-border/50 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="bg-surface p-2.5 sm:p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3">
          {/* Row 1 on mobile: Input + Options Icon Button */}
          <div className="flex items-center gap-2 flex-1">
            {/* Main search text field */}
            <div className="relative flex-1">
              {/* Magnifier static icon */}
              <div
                className="absolute inset-y-0 start-1.5 my-auto w-8 h-8 flex items-center justify-center text-text-secondary pointer-events-none"
                aria-hidden="true"
              >
                <Search className="w-4 h-4 md:w-5 md:h-5" />
              </div>

              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={handleInputChange}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit(e);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleClearInput();
                  }
                }}
                enterKeyHint="search"
                placeholder={t(
                  'ابحث بكلمة أو آية أو رقم...',
                  'Search word, ayah or ref...'
                )}
                className="w-full h-11 md:h-[52px] ps-9 md:ps-11 pe-12 md:pe-20 text-sm md:text-base bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-start"
              />
              <div className="absolute inset-y-0 end-1.5 flex items-center gap-1">
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearInput}
                    className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center text-text-secondary hover:text-text-primary rounded-md"
                    aria-label={t('مسح حقل البحث', 'Clear search')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-text-secondary/60 bg-border/40 rounded border border-border">
                  /
                </kbd>
              </div>
            </div>

            {/* Mobile Options Icon Button (Square 44px x 44px) */}
            <button
              type="button"
              onClick={() => setIsOptionsOpen(!isOptionsOpen)}
              aria-label={t('خيارات البحث والتصفية', 'Search Options and Filters')}
              className={`md:hidden h-11 w-11 rounded-lg border text-sm font-medium flex items-center justify-center transition shrink-0 relative ${
                isOptionsOpen || selectedSurahId || searchMode !== 'phrase' || matchBy !== 'phonetic' || wordMatch !== 'smart' || selectedJuz
                  ? 'bg-primary-tint text-primary border-primary/50'
                  : 'bg-background hover:bg-surface border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              {(selectedSurahId || searchMode !== 'phrase' || matchBy !== 'phonetic' || wordMatch !== 'smart' || selectedJuz) && (
                <span className="w-2 h-2 rounded-full bg-accent absolute top-2 end-2" />
              )}
            </button>
          </div>

          {/* Desktop Surah Dropdown Filter */}
          <div className="hidden md:block w-56 shrink-0">
            <select
              value={selectedSurahId || ''}
              onChange={e => {
                const sId = e.target.value ? Number(e.target.value) : undefined;
                setSelectedSurahId(sId);
                updateUrl({ surah: sId, page: 1 }, false);
              }}
              className="w-full h-[52px] px-3 text-sm bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition cursor-pointer text-start"
            >
              <option value="">{t('جميع السور (114 سورة)', 'All Surahs (114)')}</option>
              {surahs?.map(s => (
                <option key={s.id} value={s.id}>
                  {toArabicDigits(s.number)}. {t('سورة', 'Surah')} {s.nameArabic} ({toArabicDigits(s.ayahCount)} {t('آية', 'Ayahs')})
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Toggle Options Button */}
          <button
            type="button"
            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
            className={`hidden md:flex h-[52px] px-4 rounded-lg border text-sm font-medium items-center justify-center gap-2 transition shrink-0 ${
              isOptionsOpen || searchMode !== 'phrase' || matchBy !== 'phonetic' || wordMatch !== 'smart' || selectedJuz
                ? 'bg-primary-tint text-primary border-primary/50'
                : 'bg-background hover:bg-surface border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{t('خيارات متقدمة', 'Advanced Options')}</span>
            {(searchMode !== 'phrase' || matchBy !== 'phonetic' || wordMatch !== 'smart' || selectedJuz) && (
              <span className="w-2 h-2 rounded-full bg-accent" />
            )}
          </button>
        </div>

        {/* Subtle Progress Bar while in-flight search is fetching */}
        {isFetching && (
          <div className="h-0.5 w-full bg-primary/20 overflow-hidden rounded-full">
            <div className="h-full bg-primary animate-pulse w-full" />
          </div>
        )}

        {/* Gentle 1-character hint (not an error) */}
        {isSingleCharQuery && (
          <div className="px-2 py-1 text-xs text-text-secondary bg-surface/70 rounded-md border border-border/60 flex items-center gap-1.5 animate-fade-in">
            <Info className="w-3.5 h-3.5 text-accent shrink-0" />
            <span>{t('أدخل حرفين على الأقل لبدء البحث الفوري التلقائي...', 'Type at least 2 characters to search automatically...')}</span>
          </div>
        )}

        {/* Active Filters Chips Bar (Scrollable horizontally on mobile, no wrap) */}
        {(selectedSurahId || selectedJuz || searchMode !== 'phrase' || matchBy !== 'phonetic' || wordMatch !== 'smart') && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-[11px] text-text-secondary shrink-0 font-medium pe-1">
              {t('تصفية نشطة:', 'Active:')}
            </span>

            {/* Surah Chip */}
            {selectedSurahId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSurahId(undefined);
                  updateUrl({ surah: undefined, page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-tint text-primary font-medium border border-primary/20 shrink-0 hover:bg-primary-tint/80 transition"
              >
                <span>{surahs?.find(s => s.id === selectedSurahId)?.nameArabic || t('سورة', 'Surah')}</span>
                <X className="w-3 h-3 text-primary/70" />
              </button>
            )}

            {/* Juz Chip */}
            {selectedJuz && (
              <button
                type="button"
                onClick={() => {
                  setSelectedJuz(undefined);
                  updateUrl({ juz: undefined, page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-tint text-primary font-medium border border-primary/20 shrink-0 hover:bg-primary-tint/80 transition"
              >
                <span>{t('الجزء', 'Juz')} {isRtl ? toArabicDigits(selectedJuz) : selectedJuz}</span>
                <X className="w-3 h-3 text-primary/70" />
              </button>
            )}

            {/* Match By Chip */}
            {matchBy !== 'phonetic' && (
              <button
                type="button"
                onClick={() => {
                  setMatchBy('phonetic');
                  updateUrl({ matchBy: 'phonetic', page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-tint text-text-primary font-medium border border-accent/20 shrink-0 hover:bg-accent-tint/80 transition"
              >
                <span>{matchBy === 'exact' ? t('بالرسم والتشكيل', 'With Diacritics') : t('بالرسم', 'By Spelling')}</span>
                <X className="w-3 h-3 text-text-secondary" />
              </button>
            )}

            {/* Mode Chip */}
            {searchMode !== 'phrase' && (
              <button
                type="button"
                onClick={() => {
                  setSearchMode('phrase');
                  updateUrl({ mode: 'phrase', page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface text-text-secondary font-medium border border-border shrink-0 hover:border-primary/40 transition"
              >
                <span>
                  {searchMode === 'all'
                    ? t('كل الكلمات', 'All words')
                    : searchMode === 'any'
                    ? t('أي كلمة', 'Any word')
                    : searchMode === 'root'
                    ? t('متشابهات إملائية', 'Spelling/Root')
                    : searchMode}
                </span>
                <X className="w-3 h-3 text-text-secondary" />
              </button>
            )}

            {/* Whole Word Match Chip */}
            {wordMatch === 'whole' && (
              <button
                type="button"
                onClick={() => {
                  setWordMatch('smart');
                  updateUrl({ wordMatch: 'smart', page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface text-text-secondary font-medium border border-border shrink-0 hover:border-primary/40 transition"
              >
                <span>{t('كلمة كاملة', 'Whole word')}</span>
                <X className="w-3 h-3 text-text-secondary" />
              </button>
            )}

            {/* Partial Word Match Chip */}
            {wordMatch === 'partial' && (
              <button
                type="button"
                onClick={() => {
                  setWordMatch('smart');
                  updateUrl({ wordMatch: 'smart', page: 1 });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface text-text-secondary font-medium border border-border shrink-0 hover:border-primary/40 transition"
              >
                <span>{t('أي جزء', 'Any substring')}</span>
                <X className="w-3 h-3 text-text-secondary" />
              </button>
            )}

            {/* Reset All Filters Chip */}
            <button
              type="button"
              onClick={handleResetOptions}
              className="text-[11px] text-danger hover:underline shrink-0 px-1 font-medium"
            >
              {t('مسح الكل', 'Clear all')}
            </button>
          </div>
        )}

        {/* Collapsible Advanced Options Panel (Bottom sheet on mobile, card on desktop) */}
        {isOptionsOpen && (
          <div className="bg-surface p-3.5 sm:p-5 rounded-xl border border-border shadow-md space-y-4 animate-fade-in text-start max-h-[75vh] md:max-h-none overflow-y-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                {t('خيارات وتفضيلات البحث القرآني', 'Quran Search Preferences')}
              </span>
              <button
                type="button"
                onClick={handleResetOptions}
                className="text-xs text-text-secondary hover:text-danger flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('إعادة ضبط الافتراضية', 'Reset Defaults')}
              </button>
            </div>

            {/* Mobile Surah Select (Moved inside options bottom sheet on mobile) */}
            <div className="md:hidden space-y-1.5 pb-2 border-b border-border/60">
              <label className="text-xs font-semibold text-text-secondary block">
                {t('تحديد السورة الكريمة', 'Select Surah')}
              </label>
              <select
                value={selectedSurahId || ''}
                onChange={e => {
                  const sId = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedSurahId(sId);
                  updateUrl({ surah: sId, page: 1 });
                }}
                className="w-full h-11 px-3 text-sm bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary cursor-pointer text-start"
              >
                <option value="">{t('جميع السور (114 سورة)', 'All Surahs (114)')}</option>
                {surahs?.map(s => (
                  <option key={s.id} value={s.id}>
                    {toArabicDigits(s.number)}. {t('سورة', 'Surah')} {s.nameArabic} ({toArabicDigits(s.ayahCount)} {t('آية', 'Ayahs')})
                  </option>
                ))}
              </select>
            </div>

            {/* Match Basis Segmented Control */}
            <div className="space-y-1.5 pb-2 border-b border-border/60">
              <label className="text-xs font-semibold text-text-secondary block">
                {t('أساس المطابقة (البحث باللفظ أولاً)', 'Matching Basis (Phonetic-First)')}
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-background border border-border rounded-lg max-w-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMatchBy('phonetic');
                    updateUrl({ matchBy: 'phonetic', page: 1 });
                  }}
                  className={`py-2 px-2 sm:px-3 rounded-md text-xs font-semibold transition text-center ${
                    matchBy === 'phonetic'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  {t('باللفظ (افتراضي)', 'Phonetic')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatchBy('spelling');
                    updateUrl({ matchBy: 'spelling', page: 1 });
                  }}
                  className={`py-2 px-2 sm:px-3 rounded-md text-xs font-semibold transition text-center ${
                    matchBy === 'spelling'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  {t('بالرسم', 'Spelling')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMatchBy('exact');
                    updateUrl({ matchBy: 'exact', page: 1 });
                  }}
                  className={`py-2 px-2 sm:px-3 rounded-md text-xs font-semibold transition text-center ${
                    matchBy === 'exact'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                  }`}
                >
                  {t('بالتشكيل', 'Diacritics')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Search Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary block">
                  {t('نمط البحث والتطابق', 'Search Mode')}
                </label>
                <select
                  value={searchMode}
                  onChange={e => {
                    const m = e.target.value as SearchMode;
                    setSearchMode(m);
                    updateUrl({ mode: m, page: 1 });
                  }}
                  className="w-full h-10 px-3 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="phrase">{t('عبارة متتالية (الافتراضي)', 'Consecutive Phrase')}</option>
                  <option value="all">{t('جميع الكلمات بأي ترتيب', 'All Words (Any Order)')}</option>
                  <option value="any">{t('أي كلمة من الكلمات', 'Any Word')}</option>
                  <option value="root">{t('متشابهات إملائية / جذر تقريبي', 'Spelling/Root Similarity')}</option>
                  <option value="exact">{t('الآية بالكامل تطابق تام', 'Exact Whole Ayah')}</option>
                  <option value="prefix">{t('بداية الكلمة (جذور/سوابق)', 'Word Prefix')}</option>
                  <option value="contains">{t('جزء من الكلمة', 'Contains Substring')}</option>
                </select>
              </div>

              {/* Juz Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary block">
                  {t('تحديد الجزء من المصحف', 'Juz of Quran')}
                </label>
                <select
                  value={selectedJuz || ''}
                  onChange={e => {
                    const j = e.target.value ? Number(e.target.value) : undefined;
                    setSelectedJuz(j);
                    updateUrl({ juz: j, page: 1 });
                  }}
                  className="w-full h-10 px-3 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">{t('كامل المصحف (كل الأجزاء الثلاثين)', 'All 30 Juzs')}</option>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(juzNum => (
                    <option key={juzNum} value={juzNum}>
                      {t('الجزء', 'Juz')} {toArabicDigits(juzNum)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sorting Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary block">
                  {t('ترتيب النتائج', 'Sort Order')}
                </label>
                <select
                  value={sortOption}
                  onChange={e => {
                    const s = e.target.value as SortOption;
                    setSortOption(s);
                    updateUrl({ sort: s, page: 1 });
                  }}
                  className="w-full h-10 px-3 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="relevance">{t('الأقرب أولاً (افتراضي للبحث الذكي)', 'Closest First (Default for Smart)')}</option>
                  <option value="mushaf">{t('ترتيب المصحف الشريف', 'Mushaf Order')}</option>
                  <option value="surah">{t('حسب السور', 'By Surah')}</option>
                  <option value="ayahLength">{t('طول الآية', 'Verse Length')}</option>
                </select>
              </div>

              {/* Word Match 3-Way Segmented Control */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-text-secondary block">
                  {t('طريقة مطابقة الكلمات', 'Word Matching Mode')}
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-surface-muted dark:bg-surface-elevated/40 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setWordMatch('smart');
                      setSortOption('relevance');
                      updateUrl({ wordMatch: 'smart', sort: 'relevance', page: 1 });
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition text-center ${
                      wordMatch === 'smart'
                        ? 'bg-primary text-white shadow-2xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }`}
                    title={t('مطابقة ذكية ترتب النتائج بحسب درجة القرب (التطابق التام أولاً)', 'Smart matching ranked by closeness')}
                  >
                    {t('الأقرب أولاً (افتراضي)', 'Closest (Default)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWordMatch('whole');
                      updateUrl({ wordMatch: 'whole', page: 1 });
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition text-center ${
                      wordMatch === 'whole'
                        ? 'bg-primary text-white shadow-2xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }`}
                    title={t('مطابقة الكلمة بكاملها فقط بدون زوائد أو تصريفات', 'Whole word match only')}
                  >
                    {t('كلمة كاملة', 'Whole Word')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWordMatch('partial');
                      updateUrl({ wordMatch: 'partial', page: 1 });
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition text-center ${
                      wordMatch === 'partial'
                        ? 'bg-primary text-white shadow-2xs font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                    }`}
                    title={t('أي تطابق جزئي لأي مقطع من الكلمة', 'Any substring match')}
                  >
                    {t('أي جزء', 'Any Substring')}
                  </button>
                </div>
              </div>
            </div>

            {/* Close Sheet button on mobile */}
            <div className="md:hidden pt-2 border-t border-border/60 flex justify-end">
              <Button size="sm" variant="primary" onClick={() => setIsOptionsOpen(false)}>
                {t('تطبيق الإعدادات', 'Apply Settings')}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Clean Idle State (Shown when there is NO active query and NO surah/juz filter) */}
      {!isSearchActive && (
        <div className="bg-surface p-6 sm:p-10 rounded-2xl border border-border/80 shadow-xs text-center space-y-6 max-w-2xl mx-auto my-4 animate-fade-in">
          {/* Short prompt */}
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-primary-tint text-primary mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary">
              {t('ابحث بكلمة أو عبارة أو رقم آية', 'Search by word, phrase, or verse reference')}
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
              {t(
                'اكتب مباشرة في حقل البحث للبحث اللفظي التلقائي، أو اختر من الأمثلة الشائعة وعمليات البحث الأخيرة أدناه.',
                'Type directly in the search bar for instant phonetic results, or pick from recent and example queries below.'
              )}
            </p>
          </div>

          {/* Clickable Example Searches */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-text-secondary block">
              {t('أمثلة جاهزة للبحث:', 'Example Searches:')}
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: 'الرحمن', query: 'الرحمن' },
                { label: '2:255 (آية الكرسي)', query: '2:255' },
                { label: 'من قبلك', query: 'من قبلك' },
                { label: 'يسيرو', query: 'يسيرو' },
              ].map(ex => (
                <button
                  key={ex.query}
                  type="button"
                  onClick={() => {
                    setSearchInput(ex.query);
                    updateUrl({ q: ex.query, page: 1 }, false);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-background hover:bg-primary-tint text-text-primary hover:text-primary border border-border hover:border-primary/40 transition shadow-2xs"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Searches (up to 10, clickable, with clear-all) */}
          {recentSearches.length > 0 && (
            <div className="pt-4 border-t border-border/60 space-y-3 text-start">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {t('عمليات البحث الأخيرة', 'Recent Searches')}
                </span>
                <button
                  type="button"
                  onClick={clearAllRecentSearches}
                  className="text-xs text-text-secondary hover:text-danger underline transition"
                >
                  {t('مسح السجل بالكامل', 'Clear all')}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {recentSearches.map(q => (
                  <span
                    key={q}
                    onClick={() => {
                      setSearchInput(q);
                      updateUrl({ q, page: 1 }, false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-background hover:bg-primary-tint text-text-primary hover:text-primary border border-border cursor-pointer transition"
                  >
                    <span>{q}</span>
                    <button
                      type="button"
                      onClick={e => removeRecentSearch(e, q)}
                      className="text-text-secondary hover:text-danger p-0.5 rounded-full"
                      aria-label={t('حذف', 'Remove')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Surah Facet Chips Bar (Top matching surahs with counts) */}
      {isSearchActive && searchResponse?.facets && searchResponse.facets.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-text-secondary px-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              {t('توزيع الآيات المطابقة على السور:', 'Distribution across Surahs:')}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => handleSurahFacetClick(undefined)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition shrink-0 flex items-center gap-1.5 ${
                !selectedSurahId
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface hover:bg-background text-text-secondary border-border'
              }`}
            >
              <span>{t('جميع السور', 'All Surahs')}</span>
              <span className="text-[10px] bg-black/15 px-1.5 py-0.2 rounded-full">
                {isRtl ? toArabicDigits(searchResponse.totalCount) : searchResponse.totalCount}
              </span>
            </button>

            {searchResponse.facets.map(facet => {
              const isSelected = selectedSurahId === facet.surahId;
              return (
                <button
                  key={facet.surahId}
                  type="button"
                  onClick={() => handleSurahFacetClick(facet.surahId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface hover:bg-background text-text-secondary border-border hover:border-primary/40'
                  }`}
                >
                  <span>{facet.surahNameArabic}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-primary-tint text-primary'
                    }`}
                  >
                    {isRtl ? toArabicDigits(facet.count) : facet.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* View Switcher: Verses View vs Words Occurrences View */}
      {isSearchActive && queryParam && (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('verses')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'verses'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{t('عرض الآيات والنتائج', 'Verses View')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('words')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'words'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('معجم الكلمات والتصريفات', 'Words & Occurrences')}</span>
            </button>
          </div>

          {/* Execution Time Badge */}
          {searchResponse && searchResponse.executionTimeMs !== undefined && (
            <span className="text-[11px] text-text-secondary/80 flex items-center gap-1">
              <span>⚡</span>
              <span>
                {isRtl ? toArabicDigits(searchResponse.executionTimeMs) : searchResponse.executionTimeMs} {t('مللي ثانية', 'ms')}
              </span>
            </span>
          )}
        </div>
      )}

      {/* TAB CONTENT: Words Occurrences View */}
      {isSearchActive && activeTab === 'words' && queryParam && (
        <WordOccurrencesView
          query={queryParam}
          mode={searchMode}
          wordMatch={wordMatch}
          onSelectWord={word => {
            setSearchInput(word);
            setActiveTab('verses');
            updateUrl({ q: word, page: 1 });
          }}
        />
      )}

      {/* TAB CONTENT: Verses View (Active Search / Browse Only) */}
      {isSearchActive && activeTab === 'verses' && (
        <>
          {/* Capped Results Hint or Length Warning Banner */}
          {searchResponse?.searchHint && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{searchResponse.searchHint}</span>
            </div>
          )}

          {/* Results Header: Count & Bulk Selection Bar - Compact single row on mobile */}
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-text-secondary px-1 py-1">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {isLoading ? (
                <span className="truncate">{t('جارٍ جلب الآيات من المصحف الشريف...', 'Loading verses...')}</span>
              ) : searchResponse ? (
                <span className="font-medium text-text-primary flex items-center gap-1.5 flex-wrap">
                  <span>
                    {t(
                      `تم العثور على ${isRtl ? toArabicDigits(searchResponse.totalCount) : searchResponse.totalCount} آية`,
                      `Found ${searchResponse.totalCount} verses`
                    )}
                  </span>
                  {searchResponse.exactMatchesCount != null && searchResponse.partialMatchesCount != null && searchResponse.exactMatchesCount > 0 && searchResponse.partialMatchesCount > 0 && (
                    <span className="text-text-secondary text-xs font-normal">
                      ({isRtl ? toArabicDigits(searchResponse.exactMatchesCount) : searchResponse.exactMatchesCount} {t('تطابق تام', 'exact')}، {isRtl ? toArabicDigits(searchResponse.partialMatchesCount) : searchResponse.partialMatchesCount} {t('تطابق جزئي', 'partial')})
                    </span>
                  )}
                  {searchResponse.totalWordOccurrences > 0 && (
                    <span className="hidden sm:inline text-text-secondary font-normal">
                      {' — '}
                      {t(
                        `تكرر اللفظ ${isRtl ? toArabicDigits(searchResponse.totalWordOccurrences) : searchResponse.totalWordOccurrences} مرة`,
                        `matched ${searchResponse.totalWordOccurrences} times`
                      )}
                    </span>
                  )}
                  {selectedJuz && (
                    <span className="text-primary font-medium">
                      {' '}
                      ({t('جزء', 'Juz')} {isRtl ? toArabicDigits(selectedJuz) : selectedJuz})
                    </span>
                  )}
                </span>
              ) : null}

              {/* Quick 1-click toggle between Closest First (relevance) and Mushaf order */}
              {searchResponse && searchResponse.totalCount > 1 && wordMatch === 'smart' && (
                <button
                  type="button"
                  onClick={() => {
                    const nextSort = sortOption === 'relevance' ? 'mushaf' : 'relevance';
                    setSortOption(nextSort);
                    updateUrl({ sort: nextSort, page: 1 });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-surface hover:border-primary/50 text-text-primary transition shrink-0"
                  title={sortOption === 'relevance' ? t('التبديل إلى ترتيب المصحف الشريف', 'Switch to Mushaf order') : t('التبديل إلى ترتيب الأقرب أولاً', 'Switch to closest-first order')}
                >
                  <ArrowUpDown className="w-3 h-3 text-primary" />
                  <span>{sortOption === 'relevance' ? t('الأقرب أولاً', 'Closest First') : t('ترتيب المصحف', 'Mushaf Order')}</span>
                </button>
              )}
            </div>

            {/* Bulk Selection Actions: Compact dropdown on mobile, inline on desktop */}
            {searchResponse && searchResponse.items.length > 0 && (
              <div className="relative shrink-0 flex items-center gap-1.5">
                {/* Mobile Dropdown Button */}
                <div className="sm:hidden relative">
                  <button
                    type="button"
                    onClick={() => setIsSelectMenuOpen(!isSelectMenuOpen)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary-tint border border-primary/30 transition min-h-[36px]"
                    aria-label={t('قائمة تحديد الآيات', 'Selection menu')}
                  >
                    <span>{t('تحديد', 'Select')}</span>
                    {selectedVerses.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                        {isRtl ? toArabicDigits(selectedVerses.length) : selectedVerses.length}
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  </button>

                  {isSelectMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsSelectMenuOpen(false)}
                        aria-hidden="true"
                      />
                      <div className="absolute end-0 mt-1 w-52 bg-surface rounded-xl shadow-lg border border-border py-1.5 z-40 text-xs animate-fade-in text-start">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectPage();
                            setIsSelectMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-start flex items-center gap-2 hover:bg-background text-text-primary"
                        >
                          {isCurrentPageAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-text-secondary" />
                          )}
                          <span>{t('تحديد كل الصفحة', 'Select Page')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectAllCapped();
                            setIsSelectMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-start flex items-center gap-2 hover:bg-background text-text-primary border-t border-border/50"
                        >
                          <CheckSquare className="w-4 h-4 text-primary" />
                          <span>{t('تحديد كل النتائج (حتى 200)', 'Select All (Max 200)')}</span>
                        </button>

                        {selectedVerses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleClearSelection();
                              setIsSelectMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-start flex items-center gap-2 hover:bg-danger-subtle text-danger border-t border-border/50"
                          >
                            <X className="w-4 h-4 text-danger" />
                            <span>{t('إلغاء التحديد بالكامل', 'Clear Selection')}</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Desktop Inline Actions */}
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectPage}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    {isCurrentPageAllSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-text-secondary" />
                    )}
                    <span>{t('تحديد كل الصفحة', 'Select Page')}</span>
                  </button>

                  <span className="text-border">|</span>

                  <button
                    type="button"
                    onClick={handleSelectAllCapped}
                    className="text-xs text-primary hover:underline"
                    title="تحديد كل النتائج بحد أقصى 200 آية"
                  >
                    {t('تحديد كل النتائج (حتى 200)', 'Select All (Max 200)')}
                  </button>

                  {selectedVerses.length > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-primary font-semibold">
                        {t(
                          `المحدد: ${isRtl ? toArabicDigits(selectedVerses.length) : selectedVerses.length}`,
                          `Selected: ${selectedVerses.length}`
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results Verses Cards List */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <VerseCardSkeleton key={i} />
              ))}
            </div>
          ) : searchResponse && searchResponse.items.length > 0 ? (
            <div className="space-y-4">
              {searchResponse.items.map(verse => {
                const isSelected = selectedVerses.some(v => v.id === verse.id);
                return (
                  <VerseCard
                    key={verse.id}
                    verse={verse}
                    isSelected={isSelected}
                    onToggleSelect={handleToggleSelect}
                    onPreview={setPreviewVerse}
                    searchQuery={queryParam}
                  />
                );
              })}

              {/* Clean Pagination */}
              <Pagination
                currentPage={searchResponse.page}
                totalPages={searchResponse.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          ) : (
            <div className="bg-surface p-8 sm:p-12 rounded-xl border border-border text-center space-y-4">
              <Sparkles className="w-10 h-10 text-accent/80 mx-auto" />
              <h3 className="text-lg font-semibold text-text-primary">
                {t('لم يتم العثور على نتائج مطابقة', 'No matching verses found')}
              </h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                {t(
                  'لم نجد آيات مطابقة لمعايير البحث الحالية. يمكنك تجربة أحد المقترحات السريعة أدناه لتوسيع نطاق البحث:',
                  'No verses match the current search criteria. Try one of the quick suggestions below:'
                )}
              </p>

              {/* Clickable Quick Suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {searchMode !== 'root' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchMode('root');
                      updateUrl({ mode: 'root', page: 1 });
                    }}
                  >
                    {t('💡 جرب وضع المتشابهات الإملائية', 'Try spelling/root mode')}
                  </Button>
                )}

                {matchBy !== 'phonetic' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMatchBy('phonetic');
                      updateUrl({ matchBy: 'phonetic', page: 1 });
                    }}
                  >
                    {t('💡 البحث باللفظ (الافتراضي)', 'Search by pronunciation')}
                  </Button>
                )}

                {searchMode !== 'any' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchMode('any');
                      updateUrl({ mode: 'any', page: 1 });
                    }}
                  >
                    {t('البحث بأي كلمة من المدخلات', 'Search any word')}
                  </Button>
                )}

                {(selectedSurahId || selectedJuz) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSurahId(undefined);
                      setSelectedJuz(undefined);
                      updateUrl({ surah: undefined, juz: undefined, page: 1 });
                    }}
                  >
                    {t('البحث في كامل المصحف والأجزاء', 'Search entire Quran')}
                  </Button>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setSelectedSurahId(undefined);
                    setSelectedJuz(undefined);
                    setSearchMode('phrase');
                    setMatchBy('phonetic');
                    setWordMatch('smart');
                    setSortOption('relevance');
                    updateUrl({
                      q: '',
                      surah: undefined,
                      juz: undefined,
                      mode: 'phrase',
                      matchBy: 'phonetic',
                      wordMatch: 'smart',
                      sort: 'relevance',
                      page: 1,
                    });
                  }}
                >
                  {t('إعادة تعيين البحث بالكامل', 'Reset all filters')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Verse Full Preview Modal */}
      <VersePreviewModal verse={previewVerse} onClose={() => setPreviewVerse(null)} />

      {/* Floating Bottom Selection Bar */}
      <VerseSelectionBar
        selectedCount={selectedVerses.length}
        onCreateCollection={handleCreateCollection}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
};
