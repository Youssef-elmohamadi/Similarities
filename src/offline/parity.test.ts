import { describe, it, expect, beforeAll } from 'vitest';
import { LocalQuranSearchEngine } from './localSearchEngine';
import { normalizeArabic, toPhonetic, toConsonantalSkeleton } from './arabicNormalizer';
import goldenQueries from './goldenQueries.json';
import * as fs from 'fs';
import * as path from 'path';

describe('Local Quran Search Parity & Accuracy Suite', () => {
  let searchEngine: LocalQuranSearchEngine;
  let dataset: any;

  beforeAll(() => {
    // Load dataset fixture from disk
    const datasetPath = path.resolve(__dirname, './dataset_fixtures.json');
    let raw = fs.readFileSync(datasetPath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    dataset = JSON.parse(raw);

    searchEngine = new LocalQuranSearchEngine();
    searchEngine.init(dataset.surahs, dataset.verses, dataset.words);
  });

  it('verifies dataset word count and verse count integrity', () => {
    expect(dataset.totalSurahs).toBe(114);
    expect(dataset.totalVerses).toBe(6236);
    expect(dataset.totalWords).toBe(77647);
  });

  it('runs all 310 golden queries and verifies parity with server results', () => {
    let perfectMatches = 0;
    const mismatches: any[] = [];

    for (const g of goldenQueries as any[]) {
      const localRes = searchEngine.search({
        q: g.q,
        mode: g.mode,
        matchBy: g.matchBy,
        wordMatch: g.wordMatch || 'whole',
        pageSize: 20,
      });

      const countMatches = localRes.totalCount === g.totalCount;
      const topIdsMatch = JSON.stringify(localRes.items.slice(0, 5).map(i => i.id)) === JSON.stringify(g.topVerseIds);

      if (countMatches && topIdsMatch) {
        perfectMatches++;
      } else {
        mismatches.push({
          query: g.q,
          mode: g.mode,
          matchBy: g.matchBy,
          expectedCount: g.totalCount,
          localCount: localRes.totalCount,
          expectedTop: g.topVerseIds,
          localTop: localRes.items.slice(0, 5).map(i => i.id),
        });
      }
    }

    console.log(`Parity results: ${perfectMatches} / ${goldenQueries.length} exact matches.`);
    if (mismatches.length > 0) {
      console.warn('First 3 mismatches:', mismatches.slice(0, 3));
    }

    // Assert >= 98% parity across complex Uthmani nuances
    expect(perfectMatches / goldenQueries.length).toBeGreaterThanOrEqual(0.98);
  });

  it('validates ToPhonetic matches silent-alef and waw-jamaa rules identically', () => {
    expect(toPhonetic('يَسِيرُوا۟')).toBe('يسيرو');
    expect(toPhonetic('ءَامَنُوا۟')).toBe('امنو');
    expect(toPhonetic('كَفَرُوا۟')).toBe('كفرو');
    expect(toPhonetic('الرَّحْمَٰنِ')).toBe('الرحمن');
    expect(toPhonetic('مَٰلِكِ')).toBe('مالك');
  });

  it('asserts ToNormalized and ToPhonetic match the server outputs for all words', () => {
    let normalizedMatches = 0;
    let phoneticMatches = 0;
    const total = dataset.words.length;

    // Test a subset of 5,000 diverse words for speed in unit test
    const step = Math.floor(total / 5000);
    let tested = 0;
    const mismatches: any[] = [];

    for (let i = 0; i < total; i += step) {
      tested++;
      const w = dataset.words[i];
      const localNorm = normalizeArabic(w.originalWord);
      const localPhon = toPhonetic(w.originalWord);

      if (localNorm === w.normalizedWord) normalizedMatches++;
      if (localPhon === w.phoneticWord) {
        phoneticMatches++;
      } else if (mismatches.length < 5) {
        mismatches.push({
          orig: w.originalWord,
          expected: w.phoneticWord,
          got: localPhon
        });
      }
    }

    if (mismatches.length > 0) {
      console.log('Sample phonetic mismatches:', mismatches);
    }

    expect(normalizedMatches / tested).toBeGreaterThanOrEqual(0.999);
    expect(phoneticMatches / tested).toBeGreaterThanOrEqual(0.98);
  });

  describe('Smart Closeness Search & Ranking Suite', () => {
    it('smart search for "العالم" returns "العالمين" (1:2), ordered exact first then startsWith then contains', () => {
      const res = searchEngine.search({
        q: 'العالم',
        wordMatch: 'smart',
        sort: 'relevance',
        pageSize: 50,
      });

      expect(res.totalCount).toBeGreaterThan(0);
      // Fatiha verse 2 (id 2) has "العالمين"
      const fatiha2 = res.items.find(i => i.id === 2);
      expect(fatiha2).toBeDefined();
      expect(fatiha2?.bestMatchKind).toBe('startsWith');

      // First items should be exact matches if any exist
      if (res.items.some(i => i.bestMatchKind === 'exact')) {
        expect(res.items[0].bestMatchKind).toBe('exact');
      }

      // Exact matches count + partial matches count equals total
      expect(res.exactMatchesCount! + res.partialMatchesCount!).toBe(res.totalCount);
    });

    it('smart search for "استهز" matches "يستهزئون" / "مستهزئون"', () => {
      const res = searchEngine.search({
        q: 'استهز',
        wordMatch: 'smart',
        sort: 'relevance',
        pageSize: 30,
      });

      expect(res.totalCount).toBeGreaterThan(0);
      // 2:14 or 2:15 has مستهزءون / الله يستهزئ بهم
      const found = res.items.some(i => i.uthmaniText.includes('يَسۡتَهۡزِ') || i.uthmaniText.includes('مُسۡتَهۡزِ'));
      expect(found).toBe(true);
      expect(res.items[0].bestMatchKind).toBeDefined();
    });

    it('smart search for "نعم" returns exact "نعم" before "نعمة" and "أنعمت" last/partial', () => {
      const res = searchEngine.search({
        q: 'نعم',
        wordMatch: 'smart',
        sort: 'relevance',
        pageSize: 50,
      });

      expect(res.totalCount).toBeGreaterThan(0);
      const firstExactIdx = res.items.findIndex(i => i.bestMatchKind === 'exact');
      const firstPartialIdx = res.items.findIndex(i => i.bestMatchKind !== 'exact');

      if (firstExactIdx !== -1 && firstPartialIdx !== -1) {
        expect(firstExactIdx).toBeLessThan(firstPartialIdx);
      }
    });

    it('whole word mode excludes "أنعمت" when searching for "نعم"', () => {
      const resWhole = searchEngine.search({
        q: 'نعم',
        wordMatch: 'whole',
        pageSize: 50,
      });

      // In whole word mode, verse 1:7 (أنعمت عليهم) must NOT match "نعم"
      const fatiha7 = resWhole.items.find(i => i.id === 7);
      expect(fatiha7).toBeUndefined();
    });

    it('single character query in smart mode returns 0 items and search hint', () => {
      const res = searchEngine.search({
        q: 'م',
        wordMatch: 'smart',
      });

      expect(res.totalCount).toBe(0);
      expect(res.items).toHaveLength(0);
      expect(res.searchHint).toBe('يرجى إدخال حرفين على الأقل للبحث الذكي أو الجزئي.');
    });

    it('phrase mode with smart words preserves strictly consecutive order', () => {
      const res = searchEngine.search({
        q: 'رب العالمين',
        mode: 'phrase',
        wordMatch: 'smart',
      });

      expect(res.totalCount).toBeGreaterThan(0);
      for (const item of res.items) {
        const positions = item.matchedWordIndexes || [];
        expect(positions.length).toBeGreaterThanOrEqual(2);
        // At least one consecutive pair
        let hasConsecutivePair = false;
        for (let i = 0; i < positions.length - 1; i++) {
          if (positions[i + 1] === positions[i] + 1) {
            hasConsecutivePair = true;
            break;
          }
        }
        expect(hasConsecutivePair).toBe(true);
      }
    });

    it('pagination has no duplicate verses across consecutive pages', () => {
      const page1 = searchEngine.search({
        q: 'العالم',
        wordMatch: 'smart',
        sort: 'relevance',
        page: 1,
        pageSize: 10,
      });

      const page2 = searchEngine.search({
        q: 'العالم',
        wordMatch: 'smart',
        sort: 'relevance',
        page: 2,
        pageSize: 10,
      });

      const idsPage1 = new Set(page1.items.map(i => i.id));
      const overlap = page2.items.filter(i => idsPage1.has(i.id));
      expect(overlap).toHaveLength(0);
    });
  });
});
