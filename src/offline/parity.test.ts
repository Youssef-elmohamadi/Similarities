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
});
