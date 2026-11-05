// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SanitizedMarkdown, bufferPartialTokens } from './SanitizedMarkdown';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('SanitizedMarkdown', () => {
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

  it('strips harmful raw HTML tags from input', () => {
    const malicious = 'نص عادي <script>alert("hacked")</script> <img src=x onerror="steal()" /> تجربة';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={malicious} />
        </QueryClientProvider>
      );
    });

    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).not.toContain('onerror');
    expect(container.textContent).toContain('نص عادي');
    expect(container.textContent).toContain('تجربة');
  });

  it('parses markdown formatting (headings, lists, bold)', () => {
    const md = '### عنوان فرعي\n\n- نقطة أولى\n- نقطة ثانية\n\nهذا نص **عريض** ومميز';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={md} />
        </QueryClientProvider>
      );
    });

    const h3 = container.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3?.textContent).toContain('عنوان فرعي');

    const li = container.querySelectorAll('li');
    expect(li.length).toBe(2);

    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('عريض');
  });

  it('detects verse tokens [[v:surah:ayah#range]] and renders token chip', () => {
    const content = 'تأمل في قوله تعالى: [[v:6:10#1-3]] وقوله في الرعد: [[v:13:32]]';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('6:10');
    expect(container.textContent).toContain('كلمات 1-3');
    expect(container.textContent).toContain('13:32');
  });

  it('renders verse token inside **bold** formatting', () => {
    const content = 'قوله في **[[v:2:255]] آية الكرسي** معروفة';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('2:255');
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toContain('2:255');
  });

  it('renders verse token inside a list item', () => {
    const content = '- الآية الأولى: [[v:6:10]]\n- الآية الثانية: [[v:13:32]]';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('6:10');
    expect(container.textContent).toContain('13:32');
    const lis = container.querySelectorAll('li');
    expect(lis.length).toBe(2);
  });

  it('renders verse token inside a blockquote', () => {
    const content = '> قال تعالى في [[v:2:255]] وهو العلي العظيم';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('2:255');
    const quote = container.querySelector('blockquote');
    expect(quote).not.toBeNull();
  });

  it('renders adjacent verse tokens properly', () => {
    const content = 'المواضع: [[v:6:10]] و[[v:13:32]] و[[v:18:56]]';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('6:10');
    expect(container.textContent).toContain('13:32');
    expect(container.textContent).toContain('18:56');
  });

  it('bufferPartialTokens buffers partial tokens across stream chunks', () => {
    const chunk1 = 'النص الأول [[v:6:10]] ثم بدأ يذكر [[v:13';
    const buffered = bufferPartialTokens(chunk1);
    expect(buffered).not.toContain('[[v:13');
    expect(buffered).toContain('[[v:6:10]]');

    const completed = chunk1 + ':32]] انتهت الآية';
    const bufferedCompleted = bufferPartialTokens(completed);
    expect(bufferedCompleted).toContain('[[v:13:32]]');
  });

  it('renders unverified token fallback text from backend cleanly', () => {
    const content = 'المرجع [إحالة غير موثقة: 99:999] غير صالح في السياق';
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SanitizedMarkdown content={content} />
        </QueryClientProvider>
      );
    });

    expect(container.textContent).toContain('إحالة غير موثقة: 99:999');
  });
});

