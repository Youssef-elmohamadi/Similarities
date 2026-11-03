// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { generateCollectionPrintHtml, highlightVerseDifferences } from './collectionPdfGenerator';
import { CollectionDetail } from '@/types/collection';

describe('collectionPdfGenerator - Sub-Collection Print View Verification', () => {
  // Test collection with 3 sub-collections per Requirement 5:
  // Sub-collection 1: with comparisons, differences, and verses
  // Sub-collection 2: with comparative verses, connections, and notes
  // Sub-collection 3: completely empty
  const sample3SubColsCollection: CollectionDetail = {
    id: 'col-test-3-subcols',
    title: 'متشابهات سورة الأنعام والآيات المتقابلة',
    baseSurahId: 6,
    baseSurahNameArabic: 'الأنعام',
    description: 'مجموعة شاملة لدراسة وضبط متشابهات سورة الأنعام مع سائر سور القرآن الكريم.',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-03T12:00:00Z',
    verses: [
      {
        id: 'cv-1',
        collectionId: 'col-test-3-subcols',
        quranVerseId: 800,
        surahId: 6,
        surahNumber: 6,
        surahNameArabic: 'الأنعام',
        surahNameEnglish: 'Al-An\'am',
        ayahNumber: 10,
        uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُوا۟ مِنۡهُم مَّا كَانُوا۟ بِهِۦ يَسۡتَہۡزِءُونَ',
        personalNote: 'ملاحظة خاصة بالآية: ضبط موضع الأنعام بتقديم الفاء (فحاق). Note with English mixed text: Verse 10 anchor.',
        displayOrder: 0,
        addedAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'cv-2',
        collectionId: 'col-test-3-subcols',
        quranVerseId: 1739,
        surahId: 13,
        surahNumber: 13,
        surahNameArabic: 'الرعد',
        surahNameEnglish: 'Ar-Ra\'d',
        ayahNumber: 32,
        uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَأَمۡلَيۡتُ لِلَّذِينَ كَفَرُوا۟ ثُمَّ أَخَذۡتُهُمۡۖ فَكَيۡفَ كَانَ عِقَابِ',
        displayOrder: 1,
        addedAt: '2026-11-01T10:05:00Z',
      },
      {
        id: 'cv-3',
        collectionId: 'col-test-3-subcols',
        quranVerseId: 262,
        surahId: 2,
        surahNumber: 2,
        surahNameArabic: 'البقرة',
        surahNameEnglish: 'Al-Baqarah',
        ayahNumber: 255,
        uthmaniText: 'ٱللَّهُ لَاۤ إِلَـٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُۚ لَا تَأۡخُذُهُۥ سِنَةࣱ وَلَا نَوۡمࣱۚ',
        personalNote: 'آية الكرسي - أعظم آية في كتاب الله',
        displayOrder: 2,
        addedAt: '2026-11-01T10:10:00Z',
      },
    ],
    comparisons: [
      // 1. First sub-collection: with comparisons, differences, and verses
      {
        id: 'cmp-1',
        collectionId: 'col-test-3-subcols',
        title: 'موضع الآية ١٠ من سورة الأنعام مقابل الرعد',
        description: 'مقارنة بين موضع سورة الأنعام 10 وسورة الرعد 32 مع بيان فارق (فحاق / فأمليت).',
        sharedPhrases: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ',
        anchorQuranVerseId: 800,
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-02T10:00:00Z',
        verses: [
          {
            id: 'cmpv-1',
            comparisonId: 'cmp-1',
            quranVerseId: 800,
            surahNumber: 6,
            surahNameArabic: 'الأنعام',
            ayahNumber: 10,
            uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُوا۟ مِنۡهُم مَّا كَانُوا۟ بِهِۦ يَسۡتَہۡزِءُونَ',
          },
          {
            id: 'cmpv-2',
            comparisonId: 'cmp-1',
            quranVerseId: 1739,
            surahNumber: 13,
            surahNameArabic: 'الرعد',
            ayahNumber: 32,
            uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَأَمۡلَيۡتُ لِلَّذِينَ كَفَرُوا۟ ثُمَّ أَخَذۡتُهُمۡۖ فَكَيۡفَ كَانَ عِقَابِ',
          },
        ],
        differences: [
          {
            id: 'diff-1',
            comparisonId: 'cmp-1',
            quranVerseId: 800,
            surahNumber: 6,
            surahNameArabic: 'الأنعام',
            ayahNumber: 10,
            startPosition: 35,
            endPosition: 40,
            selectedText: 'فَحَاقَ',
            explanation: 'في الأنعام جاء بلفظ «فَحَاقَ» للإخبار عن إحاطة العذاب بالمستهزئين عاجلاً.',
          },
          {
            id: 'diff-2',
            comparisonId: 'cmp-1',
            quranVerseId: 1739,
            surahNumber: 13,
            surahNameArabic: 'الرعد',
            ayahNumber: 32,
            startPosition: 35,
            endPosition: 44,
            selectedText: 'فَأَمۡلَيۡتُ',
            explanation: 'في الرعد جاء بلفظ «فَأَمۡلَيۡتُ» لتأكيد الإمهال والاستدراج قبل الأخذ الشديد.',
          },
        ],
      },
      // 2. Second sub-collection: verses with notes
      {
        id: 'cmp-2',
        collectionId: 'col-test-3-subcols',
        title: 'موضع الآية ٢٥٥ من سورة البقرة (التوحيد والقيومية)',
        description: 'موضع صفات الله العلى والقيومية التامة.',
        anchorQuranVerseId: 262,
        createdAt: '2026-11-02T10:00:00Z',
        updatedAt: '2026-11-02T11:00:00Z',
        verses: [
          {
            id: 'cmpv-3',
            comparisonId: 'cmp-2',
            quranVerseId: 262,
            surahNumber: 2,
            surahNameArabic: 'البقرة',
            ayahNumber: 255,
            uthmaniText: 'ٱللَّهُ لَاۤ إِلَـٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُۚ لَا تَأۡخُذُهُۥ سِنَةࣱ وَلَا نَوۡمࣱۚ',
          },
        ],
        differences: [],
      },
      // 3. Third sub-collection: completely empty
      {
        id: 'cmp-3',
        collectionId: 'col-test-3-subcols',
        title: 'موضع قيد الإعداد (فارغ)',
        createdAt: '2026-11-03T10:00:00Z',
        updatedAt: '2026-11-03T10:00:00Z',
        verses: [],
        differences: [],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        collectionId: 'col-test-3-subcols',
        title: 'قاعدة الحرف المشترك بين السورة واللفظ',
        content: 'قاعدة: فاء (فحاق) في الأنعام تناسب فاء (الفرقان)، وهمزة (فأمليت) في الرعد تناسب همزة الابتداء. Note: memorize connection.',
        type: 'Verbal',
        displayOrder: 0,
        createdAt: '2026-11-01T11:00:00Z',
        updatedAt: '2026-11-01T11:00:00Z',
      },
    ],
    notes: [
      {
        id: 'note-1',
        collectionId: 'col-test-3-subcols',
        content: 'ملاحظة عامة تدبرية: تكرار الاستهزاء بالرسل تسلية لقلب النبي ﷺ وتثبيت للحفّاظ عند المراجعة.',
        createdAt: '2026-11-02T12:00:00Z',
        updatedAt: '2026-11-02T12:00:00Z',
      },
    ],
  };

  const parseHtml = (html: string) => {
    // Strip link tag to avoid happy-dom external stylesheet load warning
    const clean = html.replace(/<link[^>]+>/g, '');
    const parser = new DOMParser();
    return parser.parseFromString(clean, 'text/html');
  };

  it('renders a structured Table of Contents (TOC) when 2 or more sub-collections exist', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: true, fontSize: 'normal' });
    const doc = parseHtml(html);

    const toc = doc.querySelector('.toc-card');
    expect(toc).not.toBeNull();
    expect(toc?.textContent).toContain('فهرس مواضع المتشابهات');
    expect(toc?.textContent).toContain('موضع الآية ١٠ من سورة الأنعام مقابل الرعد');
    expect(toc?.textContent).toContain('موضع الآية ٢٥٥ من سورة البقرة');
    expect(toc?.textContent).toContain('موضع قيد الإعداد (فارغ)');
  });

  it('omits Table of Contents when less than 2 sub-collections are selected', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, {
      color: true,
      fontSize: 'normal',
      selectedComparisonIds: ['cmp-1'],
    });
    const doc = parseHtml(html);

    const toc = doc.querySelector('.toc-card');
    expect(toc).toBeNull();
  });

  it('computes real non-zero counts in cover header without duplicating base surah name', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: true, fontSize: 'normal' });
    const doc = parseHtml(html);

    const header = doc.querySelector('.cover-header');
    expect(header).not.toBeNull();
    // Real counts: 3 sub-collections, 3 verses, 2 differences, 1 connection, 1 note
    expect(header?.textContent).toContain('المواضع الفرعية: ٣');
    expect(header?.textContent).toContain('إجمالي الآيات: ٣');
    expect(header?.textContent).toContain('الفوارق المرصودة: ٢');
    expect(header?.textContent).toContain('روابط الحفظ: ١');
    expect(header?.textContent).toContain('الملاحظات: ١');

    // Should NOT duplicate "سورة الأساس: سورة الأنعام" because the title already contains "الأنعام"
    expect(header?.querySelector('.base-surah-tag')).toBeNull();
  });

  it('renders each sub-collection as an independent section with page breaks', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: true, fontSize: 'normal' });
    const doc = parseHtml(html);

    const sections = doc.querySelectorAll('.subcollection-section');
    expect(sections.length).toBeGreaterThanOrEqual(3);

    // Sub-col 1 has 2 verses
    expect(sections[0].textContent).toContain('الموضع ١:');
    expect(sections[0].textContent).toContain('موضع الآية ١٠ من سورة الأنعام مقابل الرعد');
    expect(sections[0].textContent).toContain('٢ آيات');
    expect(sections[0].textContent).toContain('٢ فوارق');

    // Sub-col 2 has 1 verse
    expect(sections[1].textContent).toContain('الموضع ٢:');
    expect(sections[1].textContent).toContain('موضع الآية ٢٥٥ من سورة البقرة');

    // Sub-col 3 is empty and marked clearly
    expect(sections[2].textContent).toContain('الموضع ٣:');
    expect(sections[2].textContent).toContain('هذا الموضع فارغ ولا يحتوي على آيات أو فوارق مسجلة بعد.');
  });

  it('verifies that Quranic verse text is strictly unaltered and matches exact Uthmani text', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: true, fontSize: 'normal' });
    const doc = parseHtml(html);

    // Check all quran-text paragraphs in verse cards
    const verseCards = doc.querySelectorAll('.verse-card');
    expect(verseCards.length).toBeGreaterThan(0);

    const firstVerseCard = verseCards[0];
    const quranP = firstVerseCard.querySelector('.quran-text');
    expect(quranP).not.toBeNull();

    // Extract text content excluding the ayah ornament
    const rawText = quranP?.textContent || '';
    // The expected uthmani text:
    const expected = sample3SubColsCollection.verses[0].uthmaniText;
    expect(rawText).toContain(expected);
  });

  it('handles stale highlight positions gracefully by logging a warning and keeping exact text', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const staleDiff = {
      id: 'diff-stale',
      comparisonId: 'cmp-1',
      quranVerseId: 800,
      surahNumber: 6,
      surahNameArabic: 'الأنعام',
      ayahNumber: 10,
      startPosition: 999, // Out of bounds
      endPosition: 1005,
      selectedText: 'كلمة_غير_موجودة',
      explanation: 'توجيه لكلمة غير موجودة بسبب تعديل قديم',
    };

    const originalText = 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ';
    const result = highlightVerseDifferences(originalText, [staleDiff], true);

    expect(warnSpy).toHaveBeenCalled();
    // Result should contain the exact original text without crashing or mutating
    expect(result).toBe(originalText);

    warnSpy.mockRestore();
  });

  it('renders per-verse personal notes, general collection notes, and mixed RTL/LTR text properly', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: true, fontSize: 'normal' });
    const doc = parseHtml(html);

    // Per-verse personal note in verse 1
    const verseNote = doc.querySelector('.verse-note-box');
    expect(verseNote).not.toBeNull();
    expect(verseNote?.textContent).toContain('ملاحظة خاصة بالآية: ضبط موضع الأنعام بتقديم الفاء');
    expect(verseNote?.textContent).toContain('Note with English mixed text: Verse 10 anchor.');

    // General collection-level section
    const generalSection = doc.querySelector('.collection-general-section');
    expect(generalSection).not.toBeNull();
    expect(generalSection?.textContent).toContain('ملاحظات وروابط عامة على المجموعة');
    expect(generalSection?.textContent).toContain('قاعدة الحرف المشترك بين السورة واللفظ');
    expect(generalSection?.textContent).toContain('ملاحظات الحافظ العامة');
  });

  it('applies Black & White specific styling when color mode is false', () => {
    const html = generateCollectionPrintHtml(sample3SubColsCollection, { color: false, fontSize: 'normal' });
    expect(html).toContain('diff-highlight-bw');
    expect(html).toContain('background-color: #FFFFFF');
  });
});
