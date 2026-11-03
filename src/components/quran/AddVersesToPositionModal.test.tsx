// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AddVersesToPositionModal,
  generatePositionTitle,
} from './AddVersesToPositionModal';
import { QuranVerse } from '@/types/quran';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToastProvider } from '@/components/common/Toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock dependencies
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/collections') {
        return {
          data: [
            {
              id: 'col-1',
              title: 'متشابهات سورة البقرة',
              description: 'مجموعة دراسة البقرة',
              baseSurahId: 2,
              baseSurahNameArabic: 'البقرة',
              verseCount: 5,
              comparisonCount: 2,
              connectionCount: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      }
      return { data: [] };
    }),
    post: vi.fn(async () => ({ data: { id: 'cmp-123' } })),
  },
  getApiErrorMessage: vi.fn((err: any) => err?.message || 'Error'),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-1', fullName: 'أحمد', email: 'ahmed@test.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/offline/userDataDb', () => ({
  getCachedUserCollections: vi.fn(async () => [
    {
      id: 'col-1',
      title: 'متشابهات سورة البقرة',
      description: 'مجموعة دراسة البقرة',
      baseSurahId: 2,
      baseSurahNameArabic: 'البقرة',
      verseCount: 5,
      comparisonCount: 2,
      connectionCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]),
  setCachedUserCollections: vi.fn(),
  getCachedCollectionDetail: vi.fn(),
  setCachedCollectionDetail: vi.fn(),
  enqueueOutboxOperation: vi.fn(),
}));

vi.mock('@/offline/quranDb', () => ({
  getFullVersesByIds: vi.fn(async () => []),
  getQuranDB: vi.fn(async () => ({
    getAll: vi.fn(async () => [
      { id: 2, number: 2, nameArabic: 'البقرة', ayahCount: 286 },
      { id: 6, number: 6, nameArabic: 'الأنعام', ayahCount: 165 },
    ]),
  })),
}));

describe('generatePositionTitle helper', () => {
  const v1: QuranVerse = {
    id: 17,
    surahId: 2,
    ayahNumber: 10,
    surahNameArabic: 'البقرة',
    surahNameEnglish: 'Al-Baqarah',
    uthmaniText: 'فِي قُلُوبِهِم مَّرَضٌ فَزَادَهُمُ اللَّهُ مَرَضًا',
    normalizedText: 'في قلوبهم مرض فزادهم الله مرضا',
  };

  const v2: QuranVerse = {
    id: 800,
    surahId: 6,
    ayahNumber: 10,
    surahNameArabic: 'الأنعام',
    surahNameEnglish: 'Al-An\'am',
    uthmaniText: 'وَلَقَدِ اسْتُهْزِئَ بِرُسُلٍ مِّن قَبْلِكَ',
    normalizedText: 'ولقد استهزئ برسل من قبلك',
  };

  const v3: QuranVerse = {
    id: 92,
    surahId: 2,
    ayahNumber: 85,
    surahNameArabic: 'البقرة',
    surahNameEnglish: 'Al-Baqarah',
    uthmaniText: 'ثُمَّ أَنتُمْ هَؤُلَاءِ تَقْتُلُونَ أَنفُسَكُمْ',
    normalizedText: 'ثم انتم هؤلاء تقتلون انفسكم',
  };

  it('generates title for single verse', () => {
    const title = generatePositionTitle(v1, [v1]);
    expect(title).toBe('موضع آية 10 من سورة البقرة');
  });

  it('generates title for two verses in different surahs', () => {
    const title = generatePositionTitle(v1, [v1, v2]);
    expect(title).toBe('موضع سورة البقرة [10] مقابل سورة الأنعام [10]');
  });

  it('generates title for two verses in the same surah', () => {
    const title = generatePositionTitle(v1, [v1, v3]);
    expect(title).toBe('موضع آية 10 مقابل آية 85 في سورة البقرة');
  });

  it('generates title for multiple verses', () => {
    const title = generatePositionTitle(v1, [v1, v2, v3]);
    expect(title).toBe('موضع البقرة [10] مقابل الأنعام [10] والبقرة [85]');
  });
});

describe('AddVersesToPositionModal', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const mockVerses: QuranVerse[] = [
    {
      id: 17,
      surahId: 2,
      ayahNumber: 10,
      surahNameArabic: 'البقرة',
      surahNameEnglish: 'Al-Baqarah',
      uthmaniText: 'فِي قُلُوبِهِم مَّرَضٌ',
      normalizedText: 'في قلوبهم مرض',
    },
    {
      id: 800,
      surahId: 6,
      ayahNumber: 10,
      surahNameArabic: 'الأنعام',
      surahNameEnglish: 'Al-An\'am',
      uthmaniText: 'وَلَقَدِ اسْتُهْزِئَ بِرُسُلٍ',
      normalizedText: 'ولقد استهزئ برسل',
    },
  ];

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
    // Clean up any portals added to document.body
    document.body.innerHTML = '';
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ToastProvider>
              {ui}
            </ToastProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('renders nothing when isOpen is false', () => {
    act(() => {
      root.render(
        renderWithProviders(
          <AddVersesToPositionModal
            isOpen={false}
            onClose={vi.fn()}
            selectedVerses={mockVerses}
          />
        )
      );
    });

    expect(document.body.textContent).toBe('');
  });

  it('renders modal with auto-generated title and verses when isOpen is true', async () => {
    await act(async () => {
      root.render(
        renderWithProviders(
          <AddVersesToPositionModal
            isOpen={true}
            onClose={vi.fn()}
            selectedVerses={mockVerses}
          />
        )
      );
    });

    const bodyText = document.body.textContent || '';
    expect(bodyText).toContain('إضافة موضع تشابه إلى مجموعة');
    const titleInput = document.querySelector('input[data-testid="position-title-input"]') as HTMLInputElement;
    expect(titleInput?.value).toBe('موضع سورة البقرة [10] مقابل سورة الأنعام [10]');
    expect(bodyText).toContain('سورة البقرة');
    expect(bodyText).toContain('سورة الأنعام');
    expect(bodyText).toContain('موضع الأساس (المرجع)');
  });

  it('switches tabs between existing and new collection', async () => {
    await act(async () => {
      root.render(
        renderWithProviders(
          <AddVersesToPositionModal
            isOpen={true}
            onClose={vi.fn()}
            selectedVerses={mockVerses}
          />
        )
      );
    });

    const newTabBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('إنشاء مجموعة جديدة بالآيتين')
    );
    expect(newTabBtn).toBeDefined();

    await act(async () => {
      newTabBtn?.click();
    });

    const bodyText = document.body.textContent || '';
    expect(bodyText).toContain('عنوان المجموعة الجديدة:');
  });

  it('updates title when user switches anchor verse', async () => {
    await act(async () => {
      root.render(
        renderWithProviders(
          <AddVersesToPositionModal
            isOpen={true}
            onClose={vi.fn()}
            selectedVerses={mockVerses}
          />
        )
      );
    });

    // Find the button to set verse 2 (Al-An'am, id 800) as anchor
    const setAnchorBtn = document.querySelector('button[data-testid="set-anchor-800"]') as HTMLButtonElement;
    expect(setAnchorBtn).toBeDefined();

    await act(async () => {
      setAnchorBtn?.click();
    });

    const titleInput = document.querySelector('input[data-testid="position-title-input"]') as HTMLInputElement;
    expect(titleInput?.value).toBe('موضع سورة الأنعام [10] مقابل سورة البقرة [10]');
  });

  it('submits comparison position payload when user clicks save', async () => {
    const { api } = await import('@/lib/api');
    (api.post as any).mockResolvedValueOnce({ data: { id: 'cmp-123' } });
    const onSuccess = vi.fn();

    await act(async () => {
      root.render(
        renderWithProviders(
          <AddVersesToPositionModal
            isOpen={true}
            onClose={vi.fn()}
            selectedVerses={mockVerses}
            onSuccess={onSuccess}
          />
        )
      );
    });

    // Allow query to resolve
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    // Find and click the collection card if needed
    const colCard = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('متشابهات سورة البقرة')
    );
    if (colCard) {
      await act(async () => {
        colCard.click();
      });
    }

    // Find and click the submit button
    const submitBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.includes('حفظ وإضافة الموضع للمجموعة')
    );
    expect(submitBtn).toBeDefined();
    expect(submitBtn?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      submitBtn?.click();
    });

    // Wait for mutation to complete
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    expect(api.post).toHaveBeenCalledWith(
      '/collections/col-1/comparisons',
      expect.objectContaining({
        title: 'موضع سورة البقرة [10] مقابل سورة الأنعام [10]',
        quranVerseIds: [17, 800],
        anchorQuranVerseId: 17,
      })
    );
    expect(onSuccess).toHaveBeenCalledWith('col-1', 'cmp-123');
  });
});
