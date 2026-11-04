// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProposalCard } from './ProposalCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SimilarityProposal } from '@/types/chat';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockProposal: SimilarityProposal = {
  id: 'prop-123',
  title: 'تشابه آيات النفاق في البقرة والنساء',
  reason: 'وصف حالة المنافقين في التكاسل عن الصلاة ومخادعة المؤمنين',
  verses: [
    {
      verseId: 21,
      surahNumber: 2,
      surahName: 'البقرة',
      ayahNumber: 14,
      uthmaniText: 'وَإِذَا لَقُواْ ٱلَّذِينَ ءَامَنُواْ قَالُوٓاْ ءَامَنَّا',
    },
    {
      verseId: 635,
      surahNumber: 4,
      surahName: 'النساء',
      ayahNumber: 142,
      uthmaniText: 'إِنَّ ٱلۡمُنَـٰفِقِينَ يُخَـٰدِعُونَ ٱللَّهَ وَهُوَ خَادِعُهُمۡ',
    },
  ],
  differences: 'في البقرة التركيز على لقاء المؤمنين، وفي النساء التركيز على الصلاة والرياء',
  note: 'ملاحظة تدبرية للمقارنة',
};

describe('ProposalCard', () => {
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
  });

  it('renders proposal title, reason, verses with verified text, and differences', () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProposalCard proposal={mockProposal} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('تشابه آيات النفاق في البقرة والنساء');
    expect(container.textContent).toContain('وصف حالة المنافقين');
    expect(container.textContent).toContain('سورة البقرة (الآية 14)');
    expect(container.textContent).toContain('سورة النساء (الآية 142)');
    expect(container.textContent).toContain('في البقرة التركيز على لقاء المؤمنين');
  });

  it('renders "اعتماد", "تعديل ثم اعتماد", and "تجاهل" buttons and opens edit form', () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProposalCard proposal={mockProposal} />
        </QueryClientProvider>
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const approveBtn = buttons.find((b) => b.textContent?.includes('اعتماد'));
    const editBtn = buttons.find((b) => b.textContent?.includes('تعديل ثم اعتماد'));
    const dismissBtn = buttons.find((b) => b.textContent?.includes('تجاهل'));

    expect(approveBtn).toBeDefined();
    expect(editBtn).toBeDefined();
    expect(dismissBtn).toBeDefined();

    act(() => {
      editBtn?.click();
    });

    const input = container.querySelector('input');
    expect(input).toBeDefined();
    expect(container.textContent).toContain('تأكيد واعتماد');
  });

  it('dismisses the card when "تجاهل" is clicked', () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProposalCard proposal={mockProposal} />
        </QueryClientProvider>
      );
    });

    const dismissBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('تجاهل')
    );
    expect(dismissBtn).toBeDefined();

    act(() => {
      dismissBtn?.click();
    });

    expect(container.textContent).toContain('تم التجاهل');
    expect(container.textContent).toContain('استعادة');
  });
});
