import { describe, it, expect } from 'vitest';
import { toArabicDigits, formatAyahOrnament, cn } from './utils';

describe('Frontend Utils', () => {
  it('converts western numerals to Arabic-Indic digits', () => {
    expect(toArabicDigits(1)).toBe('١');
    expect(toArabicDigits(282)).toBe('٢٨٢');
    expect(toArabicDigits('Surah 114')).toBe('Surah ١١٤');
    expect(toArabicDigits(0)).toBe('٠');
  });

  it('formats ayah numbers with traditional Quranic brackets', () => {
    expect(formatAyahOrnament(1)).toBe('﴿١﴾');
    expect(formatAyahOrnament(282)).toBe('﴿٢٨٢﴾');
  });

  it('merges tailwind class names properly', () => {
    const result = cn('bg-primary text-white', 'text-accent');
    expect(result).toContain('bg-primary');
    expect(result).toContain('text-accent');
    expect(result).not.toContain('text-white');
  });
});
