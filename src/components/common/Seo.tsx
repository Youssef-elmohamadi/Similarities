import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

export type RobotsDirective = 'index, follow' | 'noindex, follow' | 'noindex, nofollow';

export interface SeoProps {
  title?: string;
  description?: string;
  robots?: RobotsDirective;
  canonical?: string | null;
  ogUrl?: string | null;
}

const DEFAULT_TITLE = 'متشابهات القرآن | تنظيم المتشابهات اللفظية ومراجعتها';
const DEFAULT_DESC =
  'منصة الحفاظ الخاصة لدراسة وتوثيق متشابهات القرآن الكريم، ضبط الفوارق اللفظية بين الآيات، وتدوين روابط وتقنيات الحفظ بطريقة منهجية سهلة وميسرة.';

export const Seo: React.FC<SeoProps> = ({
  title,
  description,
  robots = 'noindex, nofollow',
  canonical = null,
  ogUrl = null,
}) => {
  const fullTitle = title ? (title.includes('متشابهات القرآن') ? title : `${title} - متشابهات القرآن`) : DEFAULT_TITLE;
  const desc = description || (robots === 'index, follow' ? DEFAULT_DESC : undefined);

  // Synchronize DOM elements (e.g. override or remove static tags from index.html on non-landing routes)
  useEffect(() => {
    // 1. Manage canonical link
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      if (canonicalEl) {
        canonicalEl.remove();
      }
    } else {
      if (canonicalEl) {
        canonicalEl.setAttribute('href', canonical);
      } else {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = canonical;
        document.head.appendChild(link);
      }
    }

    // 2. Manage og:url
    const ogUrlEl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      if (ogUrlEl) {
        ogUrlEl.remove();
      }
    } else {
      if (ogUrlEl) {
        ogUrlEl.setAttribute('content', ogUrl);
      } else {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:url');
        meta.content = ogUrl;
        document.head.appendChild(meta);
      }
    }
  }, [canonical, ogUrl]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="robots" content={robots} />
      {desc && <meta name="description" content={desc} />}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      {ogUrl ? <meta property="og:url" content={ogUrl} /> : null}
    </Helmet>
  );
};

