import { describe, it, expect, beforeAll } from 'vitest';
import { BinaryQuranSearchEngine, binarySearchExact, binarySearchPrefixRange } from './binaryIndexEngine';
import { LocalQuranSearchEngine } from './localSearchEngine';
import goldenQueries from './goldenQueries.json';
import * as fs from 'fs';
import * as path from 'path';

describe('BinaryQuranSearchEngine Suite', () => {
  let binaryEngine: BinaryQuranSearchEngine;
  let dataset: any;

  beforeAll(() => {
    const datasetPath = path.resolve(__dirname, './dataset_fixtures.json');
    let raw = fs.readFileSync(datasetPath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) {
      raw = raw.slice(1);
    }
    dataset = JSON.parse(raw);

    binaryEngine = new BinaryQuranSearchEngine();
    binaryEngine.buildAndInit(dataset.surahs, dataset.verses, dataset.words, dataset.versionHash || 'test-hash');
  });

  it('binary searches exact words and prefix ranges correctly', () => {
    const words = ['الله', 'الرحمن', 'الرحيم', 'الحمد', 'العالمين', 'كتاب'].sort((a, b) => a.localeCompare(b));
    for (const w of words) {
      const idx = binarySearchExact(words, w);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(words[idx]).toBe(w);
    }
    expect(binarySearchExact(words, 'غير_موجود')).toBe(-1);

    const [start, end] = binarySearchPrefixRange(words, 'الر');
    expect(end).toBeGreaterThan(start);
    for (let i = start; i < end; i++) {
      expect(words[i].startsWith('الر')).toBe(true);
    }
  });

  it('runs all 310 golden queries and verifies 100% parity with server results', () => {
    let perfectMatches = 0;
    const mismatches: any[] = [];

    for (const g of goldenQueries as any[]) {
      const res = binaryEngine.search({
        q: g.q,
        mode: g.mode,
        matchBy: g.matchBy,
        wordMatch: g.wordMatch || 'whole',
        pageSize: 20,
      });

      const countMatches = res.totalCount === g.totalCount;
      const topIdsMatch = JSON.stringify(res.items.slice(0, 5).map(i => i.id)) === JSON.stringify(g.topVerseIds);

      if (countMatches && topIdsMatch) {
        perfectMatches++;
      } else {
        mismatches.push({
          query: g.q,
          mode: g.mode,
          matchBy: g.matchBy,
          expectedCount: g.totalCount,
          localCount: res.totalCount,
          expectedTop: g.topVerseIds,
          localTop: res.items.slice(0, 5).map(i => i.id),
        });
      }
    }

    if (mismatches.length > 0) {
      console.error('Binary engine mismatches:', mismatches.slice(0, 5));
    }
    expect(perfectMatches).toBe(310);
  });

  it('serializes and reloads index with identical query results', () => {
    const serialized = binaryEngine.serializeIndex();
    expect(serialized.versionHash).toBe(dataset.versionHash || 'test-hash');
    expect(serialized.normalized.dictionary.length).toBeGreaterThan(10000);
    expect(serialized.normalized.packedPostings.length).toBeGreaterThan(50000);

    const reloadedEngine = new BinaryQuranSearchEngine();
    reloadedEngine.loadSerializedIndex(dataset.surahs, dataset.verses, serialized);

    const resOriginal = binaryEngine.search({ q: 'الحمد لله', mode: 'phrase', matchBy: 'spelling' });
    const resReloaded = reloadedEngine.search({ q: 'الحمد لله', mode: 'phrase', matchBy: 'spelling' });

    expect(resReloaded.totalCount).toBe(resOriginal.totalCount);
    expect(resReloaded.items.map(i => i.id)).toEqual(resOriginal.items.map(i => i.id));
  });

  it('produces compact payload for minimal postMessage transfer', () => {
    const compact = binaryEngine.searchCompact({
      q: 'الرحمن الرحيم',
      mode: 'phrase',
      matchBy: 'spelling',
      page: 1,
      pageSize: 20,
    });

    expect(compact.totalCount).toBeGreaterThan(0);
    expect(compact.pagedItems.length).toBeLessThanOrEqual(20);
    expect(compact.pagedItems[0].id).toBeDefined();
    expect(compact.pagedItems[0].matchedWordIndexes).toBeDefined();
    expect(compact.facets.length).toBeGreaterThan(0);

    // Hydrate
    const hydrated = binaryEngine.hydrateCompactResults(compact);
    expect(hydrated.items.length).toBe(compact.pagedItems.length);
    expect(hydrated.items[0].uthmaniText).toBeDefined();
    expect(hydrated.items[0].surahNameArabic).toBeDefined();
  });

  it('measures head-to-head performance speedup vs LocalQuranSearchEngine', () => {
    const localEngine = new LocalQuranSearchEngine();
    localEngine.init(dataset.surahs, dataset.verses, dataset.words);

    const testQueries = [
      'الله',
      'الرحمن',
      'الحمد لله',
      'قل هو الله احد',
      'العالمين',
      'موسى',
      'فرعون',
      'الذين امنوا',
      'سورة',
      'كتاب',
    ];

    const resultsSummary: Array<{
      query: string;
      localMs: number;
      binaryMs: number;
      speedup: string;
    }> = [];

    for (const q of testQueries) {
      // Warm up
      localEngine.search({ q, mode: 'phrase', matchBy: 'phonetic' });
      binaryEngine.search({ q, mode: 'phrase', matchBy: 'phonetic' });

      const iters = 20;
      const t0 = performance.now();
      for (let i = 0; i < iters; i++) {
        localEngine.search({ q, mode: 'phrase', matchBy: 'phonetic' });
      }
      const localAvg = (performance.now() - t0) / iters;

      const t1 = performance.now();
      for (let i = 0; i < iters; i++) {
        binaryEngine.search({ q, mode: 'phrase', matchBy: 'phonetic' });
      }
      const binaryAvg = (performance.now() - t1) / iters;

      resultsSummary.push({
        query: q,
        localMs: Number(localAvg.toFixed(2)),
        binaryMs: Number(binaryAvg.toFixed(2)),
        speedup: `${(localAvg / Math.max(binaryAvg, 0.01)).toFixed(1)}x`,
      });
    }

    console.table(resultsSummary);
    const avgLocal = resultsSummary.reduce((a, b) => a + b.localMs, 0) / resultsSummary.length;
    const avgBinary = resultsSummary.reduce((a, b) => a + b.binaryMs, 0) / resultsSummary.length;
    console.log(`Average Local ms: ${avgLocal.toFixed(2)}ms vs Average Binary ms: ${avgBinary.toFixed(2)}ms (Overall ${(avgLocal / avgBinary).toFixed(1)}x speedup)`);

    expect(avgBinary).toBeLessThanOrEqual(avgLocal * 1.25);
    expect(avgBinary).toBeLessThan(25); // sub-25ms average search latency
  });
});
