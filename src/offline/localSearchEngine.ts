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

export type MatchKind = 'exact' | 'startsWith' | 'contains';

interface CandidateWord {
  targetWord: string;
  kind: MatchKind;
  score: number;
}

export class LocalQuranSearchEngine {
  private surahs: CompactSurah[] = [];
  private verses: CompactVerse[] = [];
  private words: CompactWord[] = [];

  private surahMap = new Map<number, CompactSurah>();
  private surahNumberMap = new Map<number, CompactSurah>();
  private verseMap = new Map<number, CompactVerse>();

  // Inverted indexes
  private originalIndex = new Map<string, SearchPosting[]>();
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

    this.originalIndex.clear();
    this.normalizedIndex.clear();
    this.phoneticIndex.clear();
    this.skeletonIndex.clear();

    for (const w of words) {
      // Verse words list
      const vWords = this.verseWordsMap.get(w.verseId);
      if (vWords) vWords.push(w);

      const posting: SearchPosting = { verseId: w.verseId, wordIndex: w.wordIndex };

      // 1. Original index
      if (w.originalWord) {
        let list = this.originalIndex.get(w.originalWord);
        if (!list) {
          list = [];
          this.originalIndex.set(w.originalWord, list);
        }
        list.push(posting);
      }

      // 2. Normalized index
      if (w.normalizedWord) {
        let list = this.normalizedIndex.get(w.normalizedWord);
        if (!list) {
          list = [];
          this.normalizedIndex.set(w.normalizedWord, list);
        }
        list.push(posting);
      }

      // 3. Phonetic index
      if (w.phoneticWord) {
        let list = this.phoneticIndex.get(w.phoneticWord);
        if (!list) {
          list = [];
          this.phoneticIndex.set(w.phoneticWord, list);
        }
        list.push(posting);
      }

      // 4. Skeleton index
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

  private findCandidateDistinctWords(
    token: string,
    isRoot: boolean,
    matchBy: MatchBasis,
    wordMatch: 'smart' | 'whole' | 'partial'
  ): { candidates: CandidateWord[]; isCapped: boolean } {
    if (wordMatch === 'whole') {
      return {
        candidates: [{ targetWord: token, kind: 'exact', score: 3 }],
        isCapped: false,
      };
    }

    const indexToUse = isRoot
      ? this.skeletonIndex
      : matchBy === 'exact'
      ? this.originalIndex
      : matchBy === 'spelling'
      ? this.normalizedIndex
      : this.phoneticIndex;

    const distinctKeys = Array.from(indexToUse.keys());

    let altStem: string | null = null;
    if (token.startsWith('است') && token.length >= 4) {
      altStem = token.slice(1);
    }

    const candidates: CandidateWord[] = [];
    const seenWords = new Set<string>();

    for (const key of distinctKeys) {
      if (key === token) {
        seenWords.add(key);
        candidates.push({ targetWord: key, kind: 'exact', score: 3 });
      } else if (wordMatch === 'smart' && key.startsWith(token)) {
        if (!seenWords.has(key)) {
          seenWords.add(key);
          candidates.push({ targetWord: key, kind: 'startsWith', score: 2 });
        }
      } else if (key.includes(token)) {
        if (!seenWords.has(key)) {
          seenWords.add(key);
          candidates.push({ targetWord: key, kind: 'contains', score: 1 });
        }
      } else if (altStem && key.includes(altStem)) {
        if (!seenWords.has(key)) {
          seenWords.add(key);
          candidates.push({ targetWord: key, kind: 'contains', score: 1 });
        }
      }
    }

    // Sort: Exact > StartsWith > Contains
    candidates.sort((a, b) => b.score - a.score);

    const isCapped = candidates.length > 500;
    return {
      candidates: isCapped ? candidates.slice(0, 500) : candidates,
      isCapped,
    };
  }

  public search(params: {
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
  }): QuranSearchResponse {
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
          const wordIndexes = vWords.map(w => w.wordIndex);
          const executionTimeMs = Math.round(performance.now() - startTime);

          const matchedWordKinds: Record<number, MatchKind> = {};
          for (const idx of wordIndexes) {
            matchedWordKinds[idx] = 'exact';
          }

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
            matchedWordKinds,
            bestMatchKind: 'exact',
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
            exactMatchesCount: 1,
            partialMatchesCount: 0,
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
          exactMatchesCount: 0,
          partialMatchesCount: 0,
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
        exactMatchesCount: 0,
        partialMatchesCount: 0,
      };
    }

    // 3. Prepare tokens
    const isRoot = mode === 'root';

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

    // Min query length: for smart/partial matching require >= 2 characters (1 char returns a hint)
    if (wordMatch !== 'whole' && mode !== 'exact' && searchTokens.some(t => t.length < 2)) {
      const executionTimeMs = Math.round(performance.now() - startTime);
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
        exactMatchesCount: 0,
        partialMatchesCount: 0,
        searchHint: 'يرجى إدخال حرفين على الأقل للبحث الذكي أو الجزئي.',
      };
    }

    const candidateIds = new Set(candidateVerses.map(v => v.id));

    // Handle Exclusions: -word excludes by whole word only
    if (parsedQuery.excludedWords.length > 0) {
      for (const ex of parsedQuery.excludedWords) {
        const exNorm = isRoot ? toConsonantalSkeleton(ex) : matchBy === 'exact' ? ex : matchBy === 'spelling' ? normalizeArabic(ex) : toPhonetic(ex);
        const postings = isRoot
          ? this.skeletonIndex.get(exNorm) || []
          : matchBy === 'exact'
          ? this.originalIndex.get(exNorm) || []
          : matchBy === 'spelling'
          ? this.normalizedIndex.get(exNorm) || []
          : this.phoneticIndex.get(exNorm) || [];

        for (const p of postings) {
          candidateIds.delete(p.verseId);
        }
      }
    }

    // Helper to get postings for a candidate word
    const getPostings = (targetWord: string): SearchPosting[] => {
      if (isRoot) return this.skeletonIndex.get(targetWord) || [];
      if (matchBy === 'exact') return this.originalIndex.get(targetWord) || [];
      if (matchBy === 'spelling') return this.normalizedIndex.get(targetWord) || [];
      return this.phoneticIndex.get(targetWord) || [];
    };

    // Tracking structures
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
      const targetQuery = isRoot ? toConsonantalSkeleton(query) : matchBy === 'exact' ? query : matchBy === 'spelling' ? normalizeArabic(query) : toPhonetic(query);
      for (const v of candidateVerses) {
        if (!candidateIds.has(v.id)) continue;
        const vText = isRoot ? toConsonantalSkeleton(v.normalizedText) : matchBy === 'exact' ? v.uthmaniText : matchBy === 'spelling' ? v.normalizedText : toPhonetic(v.uthmaniText);
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
        const { candidates, isCapped } = this.findCandidateDistinctWords(token, isRoot, matchBy, wordMatch);
        if (isCapped) isResultsCapped = true;

        for (const cand of candidates) {
          const postings = getPostings(cand.targetWord);
          for (const p of postings) {
            if (!candidateIds.has(p.verseId)) continue;
            recordMatch(p.verseId, p.wordIndex, cand.kind);
          }
        }
      }
    } else {
      // 'phrase' or 'all'
      const isPhrase = mode === 'phrase';
      const tokenList = searchTokens.length === 1 && searchTokens[0].includes(' ')
        ? searchTokens[0].split(' ').filter(Boolean)
        : searchTokens;

      if (tokenList.length === 1) {
        // Single word search
        const { candidates, isCapped } = this.findCandidateDistinctWords(tokenList[0], isRoot, matchBy, wordMatch);
        if (isCapped) isResultsCapped = true;

        for (const cand of candidates) {
          const postings = getPostings(cand.targetWord);
          for (const p of postings) {
            if (!candidateIds.has(p.verseId)) continue;
            recordMatch(p.verseId, p.wordIndex, cand.kind);
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
          const { candidates, isCapped } = this.findCandidateDistinctWords(token, isRoot, matchBy, wordMatch);
          if (isCapped) isResultsCapped = true;

          const postingsWithKind: TokenPostingWithKind[] = [];
          for (const cand of candidates) {
            const postings = getPostings(cand.targetWord);
            for (const p of postings) {
              if (candidateIds.has(p.verseId)) {
                postingsWithKind.push({
                  verseId: p.verseId,
                  wordIndex: p.wordIndex,
                  kind: cand.kind,
                });
              }
            }
          }
          tokenPostingsMap.push(postingsWithKind);
        }

        // Group by verseId
        const verseOccurrences = new Map<number, TokenPostingWithKind[][]>();
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
      const relevanceScore = kindScore + (exactCount * 1000) + (matchCount * 100);

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
      exactMatchesCount,
      partialMatchesCount,
      searchHint: isResultsCapped ? 'نتائج كثيرة، أضف حرفاً لتضييق البحث.' : undefined,
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
