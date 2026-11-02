import {
  CompactSurah,
  CompactVerse,
  CompactWord,
} from './quranDb';
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

interface SearchPosting {
  verseId: number;
  wordIndex: number;
}

export class LocalQuranSearchEngine {
  private surahs: CompactSurah[] = [];
  private verses: CompactVerse[] = [];
  private words: CompactWord[] = [];

  private surahMap = new Map<number, CompactSurah>();
  private surahNumberMap = new Map<number, CompactSurah>();
  private verseMap = new Map<number, CompactVerse>();

  // Inverted indexes
  private normalizedIndex = new Map<string, SearchPosting[]>();
  private phoneticIndex = new Map<string, SearchPosting[]>();
  private skeletonIndex = new Map<string, SearchPosting[]>();
  private verseWordsMap = new Map<number, CompactWord[]>();

  public isReady = false;

  public init(surahs: CompactSurah[], verses: CompactVerse[], words: CompactWord[]) {
    this.surahs = surahs;
    this.verses = verses;
    this.words = words;

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

    this.normalizedIndex.clear();
    this.phoneticIndex.clear();
    this.skeletonIndex.clear();

    for (const w of words) {
      // Verse words list
      const vWords = this.verseWordsMap.get(w.verseId);
      if (vWords) vWords.push(w);

      const posting: SearchPosting = { verseId: w.verseId, wordIndex: w.wordIndex };

      // 1. Normalized index
      if (w.normalizedWord) {
        let list = this.normalizedIndex.get(w.normalizedWord);
        if (!list) {
          list = [];
          this.normalizedIndex.set(w.normalizedWord, list);
        }
        list.push(posting);
      }

      // 2. Phonetic index
      if (w.phoneticWord) {
        let list = this.phoneticIndex.get(w.phoneticWord);
        if (!list) {
          list = [];
          this.phoneticIndex.set(w.phoneticWord, list);
        }
        list.push(posting);
      }

      // 3. Skeleton index
      if (w.skeletonWord) {
        let list = this.skeletonIndex.get(w.skeletonWord);
        if (!list) {
          list = [];
          this.skeletonIndex.set(w.skeletonWord, list);
        }
        list.push(posting);
      }
    }

    this.isReady = true;
  }

  public search(params: {
    q?: string | null;
    surahId?: number;
    surahIds?: string;
    juz?: number;
    mode?: SearchMode;
    wordMatch?: 'exact' | 'partial';
    matchBy?: MatchBasis;
    diacritics?: boolean;
    sort?: SortOption;
    page?: number;
    pageSize?: number;
  }): QuranSearchResponse {
    const startTime = performance.now();
    const query = params.q || '';
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
    const mode = params.mode || 'phrase';
    const matchBy = params.matchBy || (params.diacritics ? 'exact' : 'phonetic');
    const wordMatch = params.wordMatch || 'exact';
    const sort = params.sort || 'mushaf';

    const parsedQuery = parseQuery(query);

    // 1. Direct Reference Check (e.g. 2:255)
    if (parsedQuery.directReference) {
      const { surahNumber, ayahNumber } = parsedQuery.directReference;
      const surah = this.surahNumberMap.get(surahNumber);
      if (surah) {
        const verse = this.verses.find(v => v.surahId === surah.id && v.ayahNumber === ayahNumber);
        if (verse) {
          const vWords = this.verseWordsMap.get(verse.id) || [];
          const wordIndexes = vWords.map(w => w.wordIndex);
          const executionTimeMs = Math.round(performance.now() - startTime);

          const item: VerseSearchResult = {
            id: verse.id,
            surahId: verse.surahId,
            ayahNumber: verse.ayahNumber,
            juzNumber: verse.juzNumber,
            surahNameArabic: surah.nameArabic,
            surahNameEnglish: surah.nameEnglish,
            uthmaniText: verse.uthmaniText,
            normalizedText: verse.normalizedText,
            matchedWordIndexes: wordIndexes,
            matchCount: wordIndexes.length,
            relevanceScore: 100.0,
            isDirectReference: true,
            matchLevel: 'exact',
          };

          return {
            items: [item],
            totalCount: 1,
            page: 1,
            pageSize,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            totalWordOccurrences: wordIndexes.length,
            executionTimeMs,
            facets: [{ surahId: surah.id, surahNumber: surah.number, surahNameArabic: surah.nameArabic, surahNameEnglish: surah.nameEnglish, count: 1 }],
            directReferenceFound: true,
          };
        }
      }
    }

    // Filter verses by Surah / Juz
    let candidateVerses = this.verses;
    if (params.surahId) {
      candidateVerses = candidateVerses.filter(v => v.surahId === params.surahId || v.surahId === this.surahNumberMap.get(params.surahId!)?.id);
    }
    if (params.surahIds) {
      const idList = params.surahIds.split(',').map(s => parseInt(s.trim(), 10)).filter(id => !isNaN(id) && id > 0);
      if (idList.length > 0) {
        candidateVerses = candidateVerses.filter(v => idList.includes(v.surahId) || (this.surahMap.get(v.surahId) && idList.includes(this.surahMap.get(v.surahId)!.number)));
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
          items: [],
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
        };
      }

      // Explicit browse
      const totalCount = candidateVerses.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIdx = (page - 1) * pageSize;
      const paged = candidateVerses.slice(startIdx, startIdx + pageSize);

      const items: VerseSearchResult[] = paged.map(v => {
        const surah = this.surahMap.get(v.surahId)!;
        return {
          id: v.id,
          surahId: v.surahId,
          ayahNumber: v.ayahNumber,
          juzNumber: v.juzNumber,
          surahNameArabic: surah?.nameArabic || '',
          surahNameEnglish: surah?.nameEnglish || '',
          uthmaniText: v.uthmaniText,
          normalizedText: v.normalizedText,
          matchedWordIndexes: [],
          matchCount: 0,
          relevanceScore: 0.0,
          isDirectReference: false,
        };
      });

      return {
        items,
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
      };
    }

    // 3. Prepare tokens
    const isRoot = mode === 'root';
    const isPartial = wordMatch === 'partial';

    const searchTokens: string[] = [];
    if (parsedQuery.phrases.length > 0) {
      for (const p of parsedQuery.phrases) {
        const norm = isRoot ? toConsonantalSkeleton(p) : matchBy === 'exact' ? p : matchBy === 'spelling' ? normalizeArabic(p) : toPhonetic(p);
        searchTokens.push(norm);
      }
    }
    for (const w of parsedQuery.words) {
      const norm = isRoot ? toConsonantalSkeleton(w) : matchBy === 'exact' ? w : matchBy === 'spelling' ? normalizeArabic(w) : toPhonetic(w);
      if (norm) searchTokens.push(norm);
    }

    const candidateIds = new Set(candidateVerses.map(v => v.id));

    // Handle Exclusions
    if (parsedQuery.excludedWords.length > 0) {
      for (const ex of parsedQuery.excludedWords) {
        const exNorm = isRoot ? toConsonantalSkeleton(ex) : matchBy === 'exact' ? ex : matchBy === 'spelling' ? normalizeArabic(ex) : toPhonetic(ex);
        const postings = isRoot
          ? this.skeletonIndex.get(exNorm) || []
          : matchBy === 'exact'
          ? (this.words.filter(w => w.originalWord === exNorm).map(w => ({ verseId: w.verseId, wordIndex: w.wordIndex })))
          : matchBy === 'spelling'
          ? this.normalizedIndex.get(exNorm) || []
          : this.phoneticIndex.get(exNorm) || [];

        for (const p of postings) {
          candidateIds.delete(p.verseId);
        }
      }
    }

    // Matched positions and levels
    const positionsMap = new Map<number, number[]>();
    const matchLevelsMap = new Map<number, string>();

    if (mode === 'exact') {
      // Whole Ayah exact match
      const targetQuery = isRoot ? toConsonantalSkeleton(query) : matchBy === 'exact' ? query : matchBy === 'spelling' ? normalizeArabic(query) : toPhonetic(query);
      for (const v of candidateVerses) {
        if (!candidateIds.has(v.id)) continue;
        const vText = isRoot ? toConsonantalSkeleton(v.normalizedText) : matchBy === 'exact' ? v.uthmaniText : matchBy === 'spelling' ? v.normalizedText : toPhonetic(v.uthmaniText);
        if (vText === targetQuery) {
          const vWords = this.verseWordsMap.get(v.id) || [];
          positionsMap.set(v.id, vWords.map(w => w.wordIndex));
          matchLevelsMap.set(v.id, 'exact');
        }
      }
    } else if (mode === 'prefix' || mode === 'contains') {
      // Substring / Prefix matching
      for (const token of searchTokens) {
        for (const w of this.words) {
          if (!candidateIds.has(w.verseId)) continue;
          const target = isRoot ? w.skeletonWord : matchBy === 'exact' ? w.originalWord : matchBy === 'spelling' ? w.normalizedWord : w.phoneticWord;
          const matched = mode === 'prefix' ? target.startsWith(token) : target.includes(token);
          if (matched) {
            let list = positionsMap.get(w.verseId);
            if (!list) {
              list = [];
              positionsMap.set(w.verseId, list);
            }
            if (!list.includes(w.wordIndex)) list.push(w.wordIndex);
            if (!matchLevelsMap.has(w.verseId)) matchLevelsMap.set(w.verseId, 'phonetic');
          }
        }
      }
    } else if (mode === 'any') {
      // Any Word match
      for (const token of searchTokens) {
        let postings: SearchPosting[] = [];
        if (isPartial) {
          // Substring in index keys
          const indexToUse = isRoot ? this.skeletonIndex : matchBy === 'spelling' ? this.normalizedIndex : this.phoneticIndex;
          for (const [key, list] of indexToUse.entries()) {
            if (key.includes(token)) {
              postings.push(...list);
            }
          }
        } else {
          postings = isRoot
            ? this.skeletonIndex.get(token) || []
            : matchBy === 'exact'
            ? this.words.filter(w => w.originalWord === token).map(w => ({ verseId: w.verseId, wordIndex: w.wordIndex }))
            : matchBy === 'spelling'
            ? this.normalizedIndex.get(token) || []
            : this.phoneticIndex.get(token) || [];
        }

        for (const p of postings) {
          if (!candidateIds.has(p.verseId)) continue;
          let list = positionsMap.get(p.verseId);
          if (!list) {
            list = [];
            positionsMap.set(p.verseId, list);
          }
          if (!list.includes(p.wordIndex)) list.push(p.wordIndex);
          if (!matchLevelsMap.has(p.verseId)) matchLevelsMap.set(p.verseId, 'phonetic');
        }
      }
    } else {
      // 'phrase' or 'all'
      const isPhrase = mode === 'phrase';
      const tokenList = searchTokens.length === 1 && searchTokens[0].includes(' ')
        ? searchTokens[0].split(' ').filter(Boolean)
        : searchTokens;

      if (tokenList.length === 0) {
        // Fallback
      } else {
        // For each token, gather verseIds containing it
        const tokenPostingsMap: SearchPosting[][] = [];
        for (const token of tokenList) {
          const postings = isRoot
            ? this.skeletonIndex.get(token) || []
            : matchBy === 'exact'
            ? this.words.filter(w => w.originalWord === token).map(w => ({ verseId: w.verseId, wordIndex: w.wordIndex }))
            : matchBy === 'spelling'
            ? this.normalizedIndex.get(token) || []
            : this.phoneticIndex.get(token) || [];
          tokenPostingsMap.push(postings.filter(p => candidateIds.has(p.verseId)));
        }

        if (tokenPostingsMap.length > 0) {
          // Verses containing ALL tokens
          const verseOccurrences = new Map<number, SearchPosting[][]>();
          for (let i = 0; i < tokenPostingsMap.length; i++) {
            for (const p of tokenPostingsMap[i]) {
              let arr = verseOccurrences.get(p.verseId);
              if (!arr) {
                arr = Array.from({ length: tokenPostingsMap.length }, () => []);
                verseOccurrences.set(p.verseId, arr);
              }
              arr[i].push(p);
            }
          }

          for (const [verseId, tokenMatches] of verseOccurrences.entries()) {
            if (tokenMatches.every(list => list.length > 0)) {
              if (isPhrase && tokenList.length > 1) {
                // Must be strictly consecutive: pos_i+1 == pos_i + 1
                const validConsecutivePositions: number[] = [];
                for (const first of tokenMatches[0]) {
                  let matchesSequence = true;
                  const seq = [first.wordIndex];
                  for (let step = 1; step < tokenList.length; step++) {
                    const expectedPos = first.wordIndex + step;
                    if (tokenMatches[step].some(p => p.wordIndex === expectedPos)) {
                      seq.push(expectedPos);
                    } else {
                      matchesSequence = false;
                      break;
                    }
                  }
                  if (matchesSequence) {
                    validConsecutivePositions.push(...seq);
                  }
                }

                if (validConsecutivePositions.length > 0) {
                  positionsMap.set(verseId, Array.from(new Set(validConsecutivePositions)));
                  matchLevelsMap.set(verseId, 'phonetic');
                }
              } else {
                // All words
                const allPositions = tokenMatches.flatMap(list => list.map(p => p.wordIndex));
                positionsMap.set(verseId, Array.from(new Set(allPositions)));
                matchLevelsMap.set(verseId, 'phonetic');
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

    for (const vId of matchedVerseIds) {
      const verse = this.verseMap.get(vId)!;
      const surah = this.surahMap.get(verse.surahId)!;
      const positions = positionsMap.get(vId) || [];
      const matchCount = positions.length;
      totalWordOccurrences += matchCount;

      const vWords = this.verseWordsMap.get(vId) || [];
      const relevanceScore = vWords.length > 0 ? (matchCount / vWords.length) * 100.0 : 0;

      results.push({
        id: verse.id,
        surahId: verse.surahId,
        ayahNumber: verse.ayahNumber,
        juzNumber: verse.juzNumber,
        surahNameArabic: surah?.nameArabic || '',
        surahNameEnglish: surah?.nameEnglish || '',
        uthmaniText: verse.uthmaniText,
        normalizedText: verse.normalizedText,
        matchedWordIndexes: positions.sort((a, b) => a - b),
        matchCount,
        relevanceScore: Math.round(relevanceScore * 10) / 10,
        isDirectReference: false,
        matchLevel: (matchLevelsMap.get(vId) as 'phonetic' | 'spelling' | 'exact') || 'phonetic',
      });
    }

    // Facets calculation
    const facetCounts = new Map<number, number>();
    for (const r of results) {
      facetCounts.set(r.surahId, (facetCounts.get(r.surahId) || 0) + 1);
    }
    const facets: SurahFacet[] = Array.from(facetCounts.entries())
      .map(([sId, count]) => {
        const s = this.surahMap.get(sId)!;
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
    const pagedItems = results.slice(startIdx, startIdx + pageSize);

    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      items: pagedItems,
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
    };
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
      .filter(v => v.surahId === target.surahId && v.ayahNumber < target.ayahNumber && v.ayahNumber >= target.ayahNumber - before)
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
      .filter(v => v.surahId === target.surahId && v.ayahNumber > target.ayahNumber && v.ayahNumber <= target.ayahNumber + after)
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
