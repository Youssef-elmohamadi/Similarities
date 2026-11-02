import { describe, it } from 'vitest';
import { LocalQuranSearchEngine } from './localSearchEngine';
import * as fs from 'fs';
import * as path from 'path';

describe('Benchmark 5 Sample Words (Before vs After Smart Matching)', () => {
  it('measures result counts and execution times', () => {
    const datasetPath = path.resolve(__dirname, './dataset_fixtures.json');
    let raw = fs.readFileSync(datasetPath, 'utf-8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dataset = JSON.parse(raw);

    const engine = new LocalQuranSearchEngine();
    engine.init(dataset.surahs, dataset.verses, dataset.words);

    const sampleWords = [
      'العالم',
      'استهز',
      'نعم',
      'الرحمن',
      'كتاب'
    ];

    const results: any[] = [];

    for (const word of sampleWords) {
      // 1. Before (whole word)
      const t0 = performance.now();
      const resWhole = engine.search({
        q: word,
        wordMatch: 'whole',
        sort: 'mushaf',
        pageSize: 50,
      });
      const timeWhole = Math.round((performance.now() - t0) * 100) / 100;

      // 2. After (smart word matching with closeness ranking)
      const t1 = performance.now();
      const resSmart = engine.search({
        q: word,
        wordMatch: 'smart',
        sort: 'relevance',
        pageSize: 50,
      });
      const timeSmart = Math.round((performance.now() - t1) * 100) / 100;

      results.push({
        word,
        beforeWholeCount: resWhole.totalCount,
        afterSmartCount: resSmart.totalCount,
        exactMatches: resSmart.exactMatchesCount,
        partialMatches: resSmart.partialMatchesCount,
        timeWholeMs: timeWhole,
        timeSmartMs: timeSmart,
        topVerse: resSmart.items[0]?.uthmaniText.slice(0, 30) + '...',
        topKind: resSmart.items[0]?.bestMatchKind,
      });
    }

    console.table(results);
  });
});

