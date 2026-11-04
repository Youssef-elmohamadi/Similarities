import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type QuranFontFamily = 'scheherazade' | 'amiri' | 'noto';
export type QuranFontSize = 'small' | 'medium' | 'large';

interface AppearanceContextType {
  fontFamily: QuranFontFamily;
  fontSize: QuranFontSize;
  setFontFamily: (font: QuranFontFamily) => void;
  setFontSize: (size: QuranFontSize) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const FONT_FAMILIES: Record<QuranFontFamily, string> = {
  scheherazade: "'Scheherazade New', 'Amiri Quran', 'Noto Naskh Arabic', serif",
  amiri: "'Amiri Quran', 'Scheherazade New', 'Noto Naskh Arabic', serif",
  noto: "'Noto Naskh Arabic', 'Scheherazade New', 'Amiri Quran', serif",
};

interface SizeConfig {
  mobile: string;
  tablet: string;
  desktop: string;
  compact: string;
  lineHeight: string;
}

export const FONT_SIZES: Record<QuranFontSize, SizeConfig> = {
  small: {
    mobile: '1.2rem',
    tablet: '1.35rem',
    desktop: '1.5rem',
    compact: '1.1rem',
    lineHeight: '2.3',
  },
  medium: {
    mobile: '1.35rem',
    tablet: '1.5rem',
    desktop: '1.65rem',
    compact: '1.2rem',
    lineHeight: '2.3',
  },
  large: {
    mobile: '1.55rem',
    tablet: '1.75rem',
    desktop: '1.95rem',
    compact: '1.35rem',
    lineHeight: '2.35',
  },
};

const FONT_CACHE_URLS: Record<QuranFontFamily, string[]> = {
  scheherazade: [
    '/fonts/scheherazade-new-arabic-400-normal.woff2',
    '/fonts/scheherazade-new-arabic-700-normal.woff2',
  ],
  amiri: [
    '/fonts/font_2__Xmo-Hk0rD6DbUL4_vH8Zp5v5i2ssg.woff2',
  ],
  noto: [
    '/fonts/font_16_RrQKbpV-9Dd1b1OAGA6M9PkyDuVBeN2DHV20Lg.woff2',
  ],
};

function applyCssVariables(font: QuranFontFamily, size: QuranFontSize) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const fontVal = FONT_FAMILIES[font] || FONT_FAMILIES.scheherazade;
  const sizeConfig = FONT_SIZES[size] || FONT_SIZES.medium;

  root.style.setProperty('--quran-font-family', fontVal);
  root.style.setProperty('--quran-font-size-mobile', sizeConfig.mobile);
  root.style.setProperty('--quran-font-size-tablet', sizeConfig.tablet);
  root.style.setProperty('--quran-font-size-desktop', sizeConfig.desktop);
  root.style.setProperty('--quran-font-size-compact', sizeConfig.compact);
  root.style.setProperty('--quran-line-height', sizeConfig.lineHeight);
  root.style.setProperty('--quran-text-color', '#2D3748');
}

export const AppearanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fontFamily, setFontFamilyState] = useState<QuranFontFamily>(() => {
    if (typeof window === 'undefined') return 'scheherazade';
    return (localStorage.getItem('quran_font_family') as QuranFontFamily) || 'scheherazade';
  });

  const [fontSize, setFontSizeState] = useState<QuranFontSize>(() => {
    if (typeof window === 'undefined') return 'medium';
    return (localStorage.getItem('quran_font_size') as QuranFontSize) || 'medium';
  });

  useEffect(() => {
    applyCssVariables(fontFamily, fontSize);
    localStorage.setItem('quran_font_family', fontFamily);
    localStorage.setItem('quran_font_size', fontSize);

    // Lazy load & precache fonts if needed
    if (typeof document !== 'undefined' && 'fonts' in document) {
      const fontName =
        fontFamily === 'amiri'
          ? 'Amiri Quran'
          : fontFamily === 'noto'
          ? 'Noto Naskh Arabic'
          : 'Scheherazade New';
      document.fonts.load(`16px "${fontName}"`).catch(() => {});
    }

    if (typeof window !== 'undefined' && 'caches' in window) {
      const urls = FONT_CACHE_URLS[fontFamily] || [];
      window.caches.open('quran-fonts-runtime').then(cache => {
        urls.forEach(url => {
          cache.match(url).then(matched => {
            if (!matched) {
              cache.add(url).catch(() => {});
            }
          });
        });
      }).catch(() => {});
    }
  }, [fontFamily, fontSize]);

  const setFontFamily = (f: QuranFontFamily) => setFontFamilyState(f);
  const setFontSize = (s: QuranFontSize) => setFontSizeState(s);

  return (
    <AppearanceContext.Provider
      value={{
        fontFamily,
        fontSize,
        setFontFamily,
        setFontSize,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
};

export const useAppearance = () => {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};

