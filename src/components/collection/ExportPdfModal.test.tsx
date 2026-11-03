// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExportPdfModal } from './ExportPdfModal';
import { LanguageProvider } from '@/context/LanguageContext';
import { api } from '@/lib/api';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('ExportPdfModal', () => {
  let container: HTMLDivElement;
  let root: Root;

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
    expect(document.body.textContent).toContain('تحميل ملف PDF');
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

  it('calls export API with proper params and closes on success', async () => {
    const mockBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
    (api.get as any).mockResolvedValueOnce({
      data: mockBlob,
      headers: {
        'content-disposition': 'attachment; filename="test_export.pdf"',
      },
    });

    const onClose = vi.fn();
    await renderModal({ onClose });

    const downloadButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('تحميل ملف PDF'));
    await act(async () => {
      downloadButton?.click();
    });

    expect(api.get).toHaveBeenCalledWith('/collections/test-col-id/export/pdf', {
      params: {
        color: true,
        fontSize: 'normal',
      },
      responseType: 'blob',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('handles 429 rate limit error gracefully', async () => {
    (api.get as any).mockRejectedValueOnce({
      response: {
        status: 429,
        data: { message: 'Too many requests' },
      },
    });

    await renderModal();

    const downloadButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('تحميل ملف PDF'));
    await act(async () => {
      downloadButton?.click();
    });

    expect(document.body.textContent).toContain('تم تجاوز الحد المسموح به لتصدير الملفات');
  });
});
