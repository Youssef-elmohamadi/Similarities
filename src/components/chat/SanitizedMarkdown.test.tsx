// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SanitizedMarkdown } from './SanitizedMarkdown';
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
});

