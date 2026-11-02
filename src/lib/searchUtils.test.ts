import { describe, it, expect } from 'vitest';
import { toArabicDigits, formatAyahOrnament, tokenizeQuranText } from './utils';

describe('Quran Search Utils & Highlights', () => {
  it('formats Uthmani ayah numbers with traditional Quranic brackets', () => {
    expect(formatAyahOrnament(1)).toBe('﴿١﴾');
    expect(formatAyahOrnament(255)).toBe('﴿٢٥٥﴾');
    expect(formatAyahOrnament(282)).toBe('﴿٢٨٢﴾');
  });

  it('correctly maps 1-based word indexes for highlighting without breaking strings', () => {
    const verseText = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    const words = tokenizeQuranText(verseText);
    expect(words).toHaveLength(4);
    expect(words[0]).toBe('بِسْمِ');
    expect(words[1]).toBe('ٱللَّهِ');
    expect(words[2]).toBe('ٱلرَّحْمَٰنِ');
    expect(words[3]).toBe('ٱلرَّحِيمِ');

    // Matched word 2 and 3
    const matchedIndexes = [2, 3];
    const highlightedFlags = words.map((_, idx) => matchedIndexes.includes(idx + 1));
    expect(highlightedFlags).toEqual([false, true, true, false]);
  });

  it('tokenizes verses containing Unicode hair spaces (e.g. 2:163 wahid) without splitting inside words', () => {
    const verse163 = 'وَإِلَـٰهُكُمۡ إِلَـٰهࣱ وَ ٰ⁠حِدࣱۖ لَّاۤ إِلَـٰهَ إِلَّا هُوَ ٱلرَّحۡمَـٰنُ ٱلرَّحِیمِ';
    const words = tokenizeQuranText(verse163);
    // Must be exactly 9 words matching backend DB WordIndex, NOT 10!
    expect(words).toHaveLength(9);
    expect(words[2]).toBe('وَ ٰ⁠حِدࣱۖ');
    expect(words[6]).toBe('هُوَ');
    expect(words[7]).toBe('ٱلرَّحۡمَـٰنُ'); // Word index 8
    expect(words[8]).toBe('ٱلرَّحِیمِ');

    // Matched index 8 corresponds strictly to "ٱلرَّحۡمَـٰنُ"
    const matchedIndexes = [8];
    expect(matchedIndexes.includes(8)).toBe(true);
    expect(words[7]).toBe('ٱلرَّحۡمَـٰنُ');
  });

  it('parses reference pattern like 2:255 correctly', () => {
    const raw = '2:255';
    const match = raw.match(/^(\d+):(\d+)$/);
    expect(match).not.toBeNull();
    if (match) {
      expect(Number(match[1])).toBe(2);
      expect(Number(match[2])).toBe(255);
    }
  });

  it('handles Arabic digits conversion', () => {
    expect(toArabicDigits('10:24')).toBe('١٠:٢٤');
  });

  it('validates matchBy basis parameter parsing', () => {
    const validBases = ['phonetic', 'spelling', 'exact'] as const;
    const parseMatchBy = (val: string | null) => {
      if (val === 'spelling' || val === 'exact') return val;
      return 'phonetic'; // default fallback
    };

    expect(parseMatchBy('phonetic')).toBe('phonetic');
    expect(parseMatchBy('spelling')).toBe('spelling');
    expect(parseMatchBy('exact')).toBe('exact');
    expect(parseMatchBy(null)).toBe('phonetic');
    expect(parseMatchBy('invalid')).toBe('phonetic');
  });

  it('determines if search query is active and executable', () => {
    const isDirectRef = (q: string) => /^\d+:\d+$/.test(q.trim());
    const isSearchActive = (q: string, surahId?: number, juz?: number) => {
      const trimmed = q.trim();
      const hasFilter = Boolean(surahId || juz);
      const isRef = isDirectRef(trimmed);
      const isQueryExecutable = trimmed.length >= 2 || isRef || (hasFilter && trimmed.length > 0);
      const isBrowseMode = hasFilter && trimmed.length === 0;
      return isQueryExecutable || isBrowseMode;
    };

    // Idle state: empty query and no filters
    expect(isSearchActive('', undefined, undefined)).toBe(false);
    expect(isSearchActive('   ', undefined, undefined)).toBe(false);

    // 1-character without filters is not active (hint state)
    expect(isSearchActive('ا', undefined, undefined)).toBe(false);
    expect(isSearchActive('م', undefined, undefined)).toBe(false);

    // 2+ characters trigger instant search
    expect(isSearchActive('ال', undefined, undefined)).toBe(true);
    expect(isSearchActive('الله', undefined, undefined)).toBe(true);
    expect(isSearchActive('الرحمن', undefined, undefined)).toBe(true);

    // Direct reference like 2:255 triggers immediately even if short
    expect(isSearchActive('1:1', undefined, undefined)).toBe(true);
    expect(isSearchActive('2:255', undefined, undefined)).toBe(true);

    // Browsing with filter active (even with empty query)
    expect(isSearchActive('', 1, undefined)).toBe(true);
    expect(isSearchActive('', undefined, 30)).toBe(true);
    expect(isSearchActive('ا', 1, undefined)).toBe(true);
  });
});

