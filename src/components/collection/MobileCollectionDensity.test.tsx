// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComparisonEditor } from '@/components/editor/ComparisonEditor';
import { CollectionDetailsPage } from '@/pages/CollectionDetailsPage';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToastProvider } from '@/components/common/Toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerseComparison } from '@/types/comparison';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/collections/col-test')) {
        return {
          data: {
            id: 'col-test',
            title: 'متشابهات سورة الأنعام',
            description: 'وصف تفصيلي لدراسة متشابهات سورة الأنعام ومواضعها',
            baseSurahId: 6,
            baseSurahNameArabic: 'الأنعام',
            verses: [],
            comparisons: [
              {
                id: 'cmp-1',
                collectionId: 'col-test',
                title: 'موضع الآية ١ من سورة الأنعام',
                sharedPhrases: 'ٱلۡحَمۡدُ لِلَّهِ',
                anchorQuranVerseId: 801,
                verses: [
                  {
                    id: 'cv-1',
                    comparisonId: 'cmp-1',
                    quranVerseId: 801,
                    surahNumber: 6,
                    surahNameArabic: 'الأنعام',
                    ayahNumber: 1,
                    uthmaniText: 'ٱلۡحَمۡدُ لِلَّهِ ٱلَّذِی خَلَقَ ٱلسَّمَـٰوَ ٰ⁠تِ',
                  },
                ],
                differences: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'cmp-2',
                collectionId: 'col-test',
                title: 'موضع الآية ٢ من سورة الأنعام',
                anchorQuranVerseId: 802,
                verses: [
                  {
                    id: 'cv-2',
                    comparisonId: 'cmp-2',
                    quranVerseId: 802,
                    surahNumber: 6,
                    surahNameArabic: 'الأنعام',
                    ayahNumber: 2,
                    uthmaniText: 'هُوَ ٱلَّذِی خَلَقَكُم مِّن طِینࣲ',
                  },
                ],
                differences: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'cmp-3',
                collectionId: 'col-test',
                title: 'موضع الآية ٣ من سورة الأنعام',
                anchorQuranVerseId: 803,
                verses: [
                  {
                    id: 'cv-3',
                    comparisonId: 'cmp-3',
                    quranVerseId: 803,
                    surahNumber: 6,
                    surahNameArabic: 'الأنعام',
                    ayahNumber: 3,
                    uthmaniText: 'وَهُوَ ٱللَّهُ فِی ٱلسَّمَـٰوَ ٰ⁠تِ',
                  },
                ],
                differences: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            connections: [{ id: 'conn-1', title: 'رابط', content: 'محتوى', type: 'Verbal' }],
            notes: [{ id: 'n-1', content: 'ملاحظة عامة' }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      }
      return { data: [] };
    }),
    post: vi.fn(),
  },
  getApiErrorMessage: vi.fn((err: any) => err?.message || 'Error'),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1', fullName: 'أحمد' },
    isAuthenticated: true,
  }),
}));

vi.mock('@/offline/userDataDb', () => ({
  getCachedCollectionDetail: vi.fn(),
  setCachedCollectionDetail: vi.fn(),
  enqueueOutboxOperation: vi.fn(),
  isTombstoned: vi.fn(async () => false),
}));

describe('Mobile UI Density - ComparisonEditor', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const mockComparisons: VerseComparison[] = Array.from({ length: 8 }).map((_, i) => ({
    id: `cmp-${i + 1}`,
    collectionId: 'col-test',
    title: `موضع الآية ${i + 1} من سورة الأنعام`,
    sharedPhrases: i === 0 ? 'ٱلۡحَمۡدُ لِلَّهِ' : undefined,
    anchorQuranVerseId: 800 + i,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verses: [
      {
        id: `cv-anchor-${i + 1}`,
        comparisonId: `cmp-${i + 1}`,
        quranVerseId: 800 + i,
        surahNumber: 6,
        surahNameArabic: 'الأنعام',
        ayahNumber: i + 1,
        uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ',
      },
      {
        id: `cv-other-${i + 1}`,
        comparisonId: `cmp-${i + 1}`,
        quranVerseId: 1000 + i,
        surahNumber: 34,
        surahNameArabic: 'سبإ',
        ayahNumber: i + 1,
        uthmaniText: 'ٱلۡحَمۡدُ لِلَّهِ ٱلَّذِی لَهُۥ مَا فِی ٱلسَّمَـٰوَ ٰ⁠تِ',
      },
    ],
    differences: [],
  }));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  const renderComponent = () => {
    return (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ComparisonEditor
            collectionId="col-test"
            baseSurahId={6}
            baseSurahNameArabic="الأنعام"
            verses={[]}
            comparisons={mockComparisons}
            onCreateComparison={vi.fn()}
            onDeleteComparison={vi.fn()}
            onAddDifference={vi.fn()}
            onDeleteDifference={vi.fn()}
          />
        </LanguageProvider>
      </QueryClientProvider>
    );
  };

  it('renders 8 sub-collection items collapsed by default on mobile', () => {
    act(() => {
      root.render(renderComponent());
    });

    const mobileList = document.querySelector('.md\\:hidden.divide-y');
    expect(mobileList).not.toBeNull();

    const mobileRows = mobileList?.querySelectorAll('[role="button"]');
    expect(mobileRows?.length).toBe(8);

    // Assert all rows are collapsed by default
    mobileRows?.forEach(row => {
      expect(row.getAttribute('aria-expanded')).toBe('false');
    });

    // Check verse summary is present on row (e.g. الأنعام ١ · سبإ ١)
    const firstRowText = mobileRows?.[0]?.textContent || '';
    expect(firstRowText).toContain('موضع الآية 1 من سورة الأنعام');
    expect(firstRowText).toContain('الأنعام ١');
    expect(firstRowText).toContain('سبإ ١');
  });

  it('toggles expansion in place when row is clicked', () => {
    act(() => {
      root.render(renderComponent());
    });

    const mobileList = document.querySelector('.md\\:hidden.divide-y');
    const firstRow = mobileList?.querySelectorAll('[role="button"]')?.[0] as HTMLElement;

    expect(firstRow.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('#mob-comp-panel-cmp-1')).toBeNull();

    act(() => {
      firstRow.click();
    });

    expect(firstRow.getAttribute('aria-expanded')).toBe('true');
    const expandedPanel = document.querySelector('#mob-comp-panel-cmp-1');
    expect(expandedPanel).not.toBeNull();
    expect(expandedPanel?.textContent).toContain('وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ');
  });

  it('supports keyboard expansion via Enter key', () => {
    act(() => {
      root.render(renderComponent());
    });

    const mobileList = document.querySelector('.md\\:hidden.divide-y');
    const firstRow = mobileList?.querySelectorAll('[role="button"]')?.[0] as HTMLElement;

    act(() => {
      firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(firstRow.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#mob-comp-panel-cmp-1')).not.toBeNull();
  });

  it('renders mobile section toolbar with single toggle button', () => {
    act(() => {
      root.render(renderComponent());
    });

    const mobileToolbar = document.querySelector('.md\\:hidden.flex.items-center.justify-between');
    expect(mobileToolbar).not.toBeNull();
    expect(mobileToolbar?.textContent).toContain('مواضع سورة الأنعام');

    // Button to expand all
    const toggleBtn = mobileToolbar?.querySelector('button') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.textContent).toContain('فتح الكل');

    act(() => {
      toggleBtn.click();
    });

    // Now all 8 items should be expanded
    const mobileRows = document.querySelectorAll('.md\\:hidden.divide-y [role="button"]');
    mobileRows.forEach(row => {
      expect(row.getAttribute('aria-expanded')).toBe('true');
    });

    // Button text switches to Collapse All
    expect(toggleBtn.textContent).toContain('طي الكل');
  });
});

describe('Mobile UI Density - CollectionDetailsPage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  const renderPage = () => (
    <HelmetProvider>
      <MemoryRouter initialEntries={['/collections/col-test']}>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ToastProvider>
              <Routes>
                <Route path="/collections/:id" element={<CollectionDetailsPage />} />
              </Routes>
            </ToastProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </HelmetProvider>
  );

  it('renders compact mobile header with more menu, inline stats line, and FAB', async () => {
    await act(async () => {
      root.render(renderPage());
    });

    // Wait for useQuery to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Mobile compact card
    const mobileHeader = document.querySelector('.md\\:hidden.flex-col');
    expect(mobileHeader).not.toBeNull();

    // Row 1: Back + Title + (⋯) More Menu
    expect(mobileHeader?.textContent).toContain('متشابهات سورة الأنعام');
    const moreBtn = mobileHeader?.querySelector('button[aria-label="خيارات المجموعة"]') as HTMLButtonElement;
    expect(moreBtn).not.toBeNull();

    // Row 3: Single muted stats line (٣ مواضع · ١ روابط · ١ ملاحظات)
    expect(mobileHeader?.textContent).toContain('٣ مواضع · ١ روابط · ١ ملاحظات');

    // Mobile FAB for "+ إضافة موضع"
    const fabBtn = document.querySelector('button[aria-label="إضافة موضع تشابه جديد"]');
    expect(fabBtn).not.toBeNull();

    // Test More Menu interaction
    act(() => {
      moreBtn.click();
    });

    const menuPopup = document.querySelector('.absolute.end-0.top-full');
    expect(menuPopup).not.toBeNull();
    expect(menuPopup?.textContent).toContain('تصدير PDF');
    expect(menuPopup?.textContent).toContain('تعديل المجموعة');
    expect(menuPopup?.textContent).toContain('حذف المجموعة');
  });

  it('renders sticky segmented tab bar with plain counts on mobile', async () => {
    await act(async () => {
      root.render(renderPage());
    });

    // Wait for useQuery to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const mobileTabs = document.querySelector('.md\\:hidden.sticky.top-14');
    expect(mobileTabs).not.toBeNull();

    const tabButtons = mobileTabs?.querySelectorAll('button');
    expect(tabButtons?.length).toBe(3);

    // Assert counts are in parentheses as plain text
    expect(tabButtons?.[0]?.textContent).toContain('المواضع (٣)');
    expect(tabButtons?.[1]?.textContent).toContain('الروابط (١)');
    expect(tabButtons?.[2]?.textContent).toContain('ملاحظات (١)');
  });
});
