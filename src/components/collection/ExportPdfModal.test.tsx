// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportPdfModal } from './ExportPdfModal';
import { LanguageProvider } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { exportCollectionToPdf } from '@/lib/collectionPdfGenerator';
import { CollectionDetail } from '@/types/collection';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/lib/collectionPdfGenerator', () => ({
  exportCollectionToPdf: vi.fn(),
}));

describe('ExportPdfModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  const sampleCollection: CollectionDetail = {
    id: 'test-col-id',
    title: 'متشابهات سورة الأنعام',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verses: [
      {
        id: 'v1',
        collectionId: 'test-col-id',
        quranVerseId: 800,
        surahId: 6,
        surahNumber: 6,
        surahNameArabic: 'الأنعام',
        surahNameEnglish: 'Al-An\'am',
        ayahNumber: 10,
        uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُوا۟ مِنۡهُم مَّا كَانُوا۟ بِهِۦ يَسۡتَہۡزِءُونَ',
        displayOrder: 0,
        addedAt: new Date().toISOString(),
      },
    ],
    comparisons: [],
    connections: [],
    notes: [],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  const renderModal = async (props?: Partial<React.ComponentProps<typeof ExportPdfModal>>) => {
    await act(async () => {
      root.render(
        <LanguageProvider>
          <ExportPdfModal
            isOpen={true}
            onClose={vi.fn()}
            collectionId="test-col-id"
            collectionTitle="متشابهات سورة الأنعام"
            collection={sampleCollection}
            hasUnsavedChanges={false}
            {...props}
          />
        </LanguageProvider>
      );
    });
  };

  it('renders correctly with default options', async () => {
    await renderModal();

    expect(document.body.textContent).toContain('تصدير المجموعة إلى ملف PDF');
    expect(document.body.textContent).toContain('نمط الألوان');
    expect(document.body.textContent).toContain('حجم خط الآيات القرآنية');
    expect(document.body.textContent).toContain('تصدير / حفظ كـ PDF');
  });

  it('updates and persists color mode to localStorage', async () => {
    await renderModal();

    const bwButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('أبيض وأسود'));
    expect(bwButton).toBeDefined();

    await act(async () => {
      bwButton?.click();
    });

    expect(localStorage.getItem('pdf_export_color')).toBe('false');

    const colorButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('ملون'));
    await act(async () => {
      colorButton?.click();
    });

    expect(localStorage.getItem('pdf_export_color')).toBe('true');
  });

  it('updates and persists font size to localStorage', async () => {
    await renderModal();

    const largeButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('كبير'));
    await act(async () => {
      largeButton?.click();
    });

    expect(localStorage.getItem('pdf_export_font_size')).toBe('large');

    const normalButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('عادي'));
    await act(async () => {
      normalButton?.click();
    });

    expect(localStorage.getItem('pdf_export_font_size')).toBe('normal');
  });

  it('displays unsaved changes warning when hasUnsavedChanges is true', async () => {
    await renderModal({ hasUnsavedChanges: true });

    expect(document.body.textContent).toContain('تنبيه: توجد تعديلات قيد المزامنة');
  });

  it('calls exportCollectionToPdf with proper options when collection is provided', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });

    const exportButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('تصدير / حفظ كـ PDF'));
    await act(async () => {
      exportButton?.click();
    });

    expect(exportCollectionToPdf).toHaveBeenCalledWith(sampleCollection, {
      color: true,
      fontSize: 'normal',
    });
  });

  it('fetches collection from API if collection prop is missing', async () => {
    (api.get as any).mockResolvedValueOnce({
      data: sampleCollection,
    });

    await renderModal({ collection: undefined });

    const exportButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('تصدير / حفظ كـ PDF'));
    await act(async () => {
      exportButton?.click();
    });

    expect(api.get).toHaveBeenCalledWith('/collections/test-col-id');
    expect(exportCollectionToPdf).toHaveBeenCalledWith(sampleCollection, {
      color: true,
      fontSize: 'normal',
    });
  });
});
