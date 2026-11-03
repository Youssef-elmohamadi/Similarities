// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HelmetProvider } from 'react-helmet-async';
import { Seo } from './Seo';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Seo Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    document.title = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.head.innerHTML = '';
  });

  it('sets noindex, nofollow by default for private routes and sets document title', async () => {
    const helmetContext = {};
    await act(async () => {
      root.render(
        <HelmetProvider context={helmetContext}>
          <Seo title="لوحة التحكم" />
        </HelmetProvider>
      );
    });

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute('content')).toBe('noindex, nofollow');
    expect(document.title).toContain('لوحة التحكم');
    expect(document.title).toContain('متشابهات القرآن');

    // Ensure no dangling canonical or og:url
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  });

  it('sets noindex, follow on auth pages (login / register)', async () => {
    const helmetContext = {};
    await act(async () => {
      root.render(
        <HelmetProvider context={helmetContext}>
          <Seo title="تسجيل الدخول" robots="noindex, follow" />
        </HelmetProvider>
      );
    });

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute('content')).toBe('noindex, follow');
    expect(document.title).toBe('تسجيل الدخول - متشابهات القرآن');
  });

  it('sets index, follow and attaches canonical and og:url on the landing page', async () => {
    const helmetContext = {};
    const landingCanonical = 'https://quran-similarities-sandy.vercel.app/';
    await act(async () => {
      root.render(
        <HelmetProvider context={helmetContext}>
          <Seo
            title="متشابهات القرآن | تنظيم المتشابهات اللفظية ومراجعتها"
            robots="index, follow"
            canonical={landingCanonical}
            ogUrl={landingCanonical}
          />
        </HelmetProvider>
      );
    });

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute('content')).toBe('index, follow');

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    expect(canonicalLink?.getAttribute('href')).toBe(landingCanonical);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    expect(ogUrl?.getAttribute('content')).toBe(landingCanonical);
  });

  it('removes pre-existing canonical link and og:url when navigating to private routes', async () => {
    // Simulate pre-existing static canonical tag from index.html
    const existingCanonical = document.createElement('link');
    existingCanonical.rel = 'canonical';
    existingCanonical.href = 'https://quran-similarities-sandy.vercel.app/';
    document.head.appendChild(existingCanonical);

    const existingOgUrl = document.createElement('meta');
    existingOgUrl.setAttribute('property', 'og:url');
    existingOgUrl.content = 'https://quran-similarities-sandy.vercel.app/';
    document.head.appendChild(existingOgUrl);

    expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();

    // Now render a private route with Seo (default noindex, nofollow, canonical=null)
    const helmetContext = {};
    await act(async () => {
      root.render(
        <HelmetProvider context={helmetContext}>
          <Seo title="الإعدادات" robots="noindex, nofollow" />
        </HelmetProvider>
      );
    });

    // Verified: canonical and og:url are purged from DOM
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();

    const robotsMeta = document.querySelector('meta[name="robots"]');
    expect(robotsMeta?.getAttribute('content')).toBe('noindex, nofollow');
  });
});
