import React, { useState } from 'react';
import { QuranVerse, VerseSearchResult, VerseContext } from '@/types/quran';
import { Badge } from '@/components/common/Badge';
import { Copy, Check, Eye, ChevronDown, ChevronUp, BookOpen, Sparkles } from 'lucide-react';
import { copyToClipboard, toArabicDigits, formatAyahOrnament, tokenizeQuranText } from '@/lib/utils';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { isOfflineDatasetAvailable } from '@/offline/quranDb';
import { getLocalVerseContext } from '@/offline/searchWorkerClient';

export interface VerseCardProps {
  verse: VerseSearchResult | QuranVerse;
  isSelected?: boolean;
  onToggleSelect?: (verse: QuranVerse) => void;
  onPreview?: (verse: QuranVerse) => void;
  searchQuery?: string;
}

export const VerseCard: React.FC<VerseCardProps> = ({
  verse,
  isSelected = false,
  onToggleSelect,
  onPreview,
  searchQuery,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [showContext, setShowContext] = useState(false);
  const [contextData, setContextData] = useState<VerseContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  const toast = useToast();
  const { t, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const searchResult = verse as VerseSearchResult;
  const matchedIndexes = searchResult.matchedWordIndexes || [];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const formatted = `﴿${verse.uthmaniText}﴾ [سورة ${verse.surahNameArabic}: ${verse.ayahNumber}]`;
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      toast.success(t('تم نسخ الآية مع التوثيق', 'Verse copied with reference'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleContext = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showContext && !contextData) {
      setIsLoadingContext(true);
      try {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const hasLocal = await isOfflineDatasetAvailable();
        if (hasLocal) {
          try {
            const localCtx = await getLocalVerseContext(verse.id, 1, 1);
            if (localCtx) {
              setContextData(localCtx);
              setShowContext(true);
              setIsLoadingContext(false);
              return;
            }
          } catch (workerErr) {
            console.warn('Local verse context failed:', workerErr);
            if (isOffline) throw workerErr;
          }
        }

        const res = await api.get<VerseContext>(`/quran/verses/${verse.id}/context?before=1&after=1`);
        setContextData(res.data);
      } catch {
        toast.error(t('تعذر تحميل سياق الآية', 'Failed to load verse context'));
      } finally {
        setIsLoadingContext(false);
      }
    }
    setShowContext(!showContext);
  };

  // Safe word-by-word highlight based on inverted index matchedWordIndexes
  const renderVerseContent = () => {
    const rawWords = tokenizeQuranText(verse.uthmaniText);
    const ornament = formatAyahOrnament(verse.ayahNumber);
    const matchedKinds = searchResult.matchedWordKinds || {};

    if (matchedIndexes.length > 0) {
      return (
        <>
          {rawWords.map((word, idx) => {
            const wordPosition = idx + 1; // 1-based index
            const isMatch = matchedIndexes.includes(wordPosition);

            if (!isMatch) {
              return (
                <span key={idx} className="mx-0.5 inline-block">
                  {word}
                </span>
              );
            }

            const kind = matchedKinds[wordPosition];
            const isExact = kind === 'exact';

            return (
              <mark
                key={idx}
                className={
                  isExact
                    ? "bg-amber-200/90 dark:bg-amber-900/60 text-text-primary px-1.5 py-0.5 rounded border-b-2 border-amber-600 dark:border-amber-400 font-semibold inline-block mx-0.5 shadow-2xs"
                    : "bg-[#F6EEDC] dark:bg-amber-950/40 text-text-primary px-1 py-0.5 rounded border-b border-primary/50 inline-block mx-0.5 shadow-2xs"
                }
                title={isExact ? t('تطابق تام', 'Exact match') : t('تطابق جزئي', 'Partial match')}
              >
                {word}
              </mark>
            );
          })}
          <span className="ayah-number-badge text-primary font-bold ms-1 select-none">
            {ornament}
          </span>
        </>
      );
    }

    // Fallback: simple text rendering with Ayah ornament
    return (
      <>
        {verse.uthmaniText}{' '}
        <span className="ayah-number-badge text-primary font-bold ms-1 select-none">
          {ornament}
        </span>
      </>
    );
  };

  return (
    <div
      onClick={() => onToggleSelect && onToggleSelect(verse)}
      className={`group relative rounded-xl border p-3 md:p-6 transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'bg-primary-tint/30 border-primary shadow-xs ring-1 ring-primary/30'
          : 'bg-surface border-border hover:border-primary/40 hover:shadow-sm'
      }`}
    >
      {/* Direct reference banner if matched by exact number reference */}
      {searchResult.isDirectReference && (
        <div className="mb-2 md:mb-3 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] md:text-xs text-primary font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>{t('نتيجة مطابقة مباشرة لرقم الآية والسورة', 'Direct match for Surah and Ayah reference')}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* Desktop Header (>= 768px): 100% Unchanged Layout          */}
      {/* ========================================================= */}
      <div className="hidden md:flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {onToggleSelect && (
            <label
              className="min-w-[40px] min-h-[40px] -ms-2 flex items-center justify-center cursor-pointer touch-manipulation"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(verse)}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
                aria-label={t(
                  `تحديد الآية ${verse.ayahNumber} من سورة ${verse.surahNameArabic}`,
                  `Select verse ${verse.ayahNumber} of Surah ${verse.surahNameEnglish}`
                )}
              />
            </label>
          )}

          <Badge variant="primary" size="sm">
            {t('سورة', 'Surah')} {verse.surahNameArabic}
          </Badge>

          <Badge variant="charcoal" size="sm">
            {t('الآية', 'Ayah')} {isRtl ? toArabicDigits(verse.ayahNumber) : verse.ayahNumber}
          </Badge>

          {verse.juzNumber && (
            <Badge variant="outline" size="sm">
              {t('الجزء', 'Juz')} {isRtl ? toArabicDigits(verse.juzNumber) : verse.juzNumber}
            </Badge>
          )}

          {searchResult.bestMatchKind && (
            searchResult.bestMatchKind === 'exact' ? (
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                {t('تطابق تام', 'Exact match')}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                {t('تطابق جزئي', 'Partial match')}
              </span>
            )
          )}

          {searchResult.matchLevel === 'phonetic' && !searchResult.bestMatchKind && (
            <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              {t('تطابق لفظي', 'Phonetic match')}
            </span>
          )}

          {searchResult.matchLevel === 'exact' && !searchResult.bestMatchKind && (
            <span className="text-[11px] font-medium text-primary bg-primary-tint/80 px-2 py-0.5 rounded-full border border-primary/30 flex items-center gap-1">
              {t('تطابق بالتشكيل', 'Exact diacritics')}
            </span>
          )}

          {searchResult.matchCount && searchResult.matchCount > 1 ? (
            <span className="text-[11px] font-medium text-accent bg-accent-tint/60 px-2 py-0.5 rounded-full border border-accent/20">
              {isRtl ? toArabicDigits(searchResult.matchCount) : searchResult.matchCount} {t('تطابقات بالآية', 'matches')}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
          {/* Show Context Button */}
          <button
            type="button"
            onClick={handleToggleContext}
            title={showContext ? t('إخفاء السياق', 'Hide context') : t('عرض السياق (الآيات السابقة واللاحقة)', 'Show context')}
            aria-label={t('عرض سياق الآية', 'Show verse context')}
            className={`min-w-[34px] min-h-[34px] px-2 text-xs inline-flex items-center gap-1 rounded-lg transition ${
              showContext
                ? 'bg-primary text-white'
                : 'text-text-secondary hover:text-primary hover:bg-primary-tint'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-sans text-[11px]">
              {showContext ? t('إخفاء السياق', 'Hide') : t('السياق', 'Context')}
            </span>
            {showContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {onPreview && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onPreview(verse);
              }}
              title={t('عرض الآية بالكامل', 'View Full Verse')}
              aria-label={t('عرض الآية بالكامل', 'View Full Verse')}
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-primary-tint transition"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title={t('نسخ الآية مع التوثيق', 'Copy verse with reference')}
            aria-label={t('نسخ الآية مع التوثيق', 'Copy verse with reference')}
            className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-primary-tint transition"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Mobile Compact Header (< 768px): One Muted Reference Line */}
      {/* ========================================================= */}
      <div className="md:hidden flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onToggleSelect && (
            <label
              className="min-w-[40px] min-h-[40px] -ms-2 flex items-center justify-center cursor-pointer touch-manipulation shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(verse)}
                className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer accent-primary"
                aria-label={t(
                  `تحديد الآية ${verse.ayahNumber} من سورة ${verse.surahNameArabic}`,
                  `Select verse ${verse.ayahNumber} of Surah ${verse.surahNameEnglish}`
                )}
              />
            </label>
          )}

          <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium truncate">
            <span className="font-bold text-text-primary">
              {t('سورة', 'Surah')} {verse.surahNameArabic}: {isRtl ? toArabicDigits(verse.ayahNumber) : verse.ayahNumber}
            </span>
            {verse.juzNumber && (
              <>
                <span className="text-text-secondary/40 select-none">·</span>
                <span>{t('الجزء', 'Juz')} {isRtl ? toArabicDigits(verse.juzNumber) : verse.juzNumber}</span>
              </>
            )}
            {searchResult.bestMatchKind && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold ms-1 shrink-0">
                {searchResult.bestMatchKind === 'exact' ? t('تام', 'Exact') : t('جزئي', 'Partial')}
              </span>
            )}
          </div>
        </div>

        {/* Mobile Action Icons (min 40px touch targets, single row) */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleToggleContext}
            title={t('عرض السياق', 'Show context')}
            aria-label={t('عرض سياق الآية', 'Show verse context')}
            className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition ${
              showContext ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {onPreview && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onPreview(verse);
              }}
              title={t('عرض الآية بالكامل', 'View Full Verse')}
              aria-label={t('عرض الآية بالكامل', 'View Full Verse')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-text-secondary hover:text-primary transition"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            title={t('نسخ الآية مع التوثيق', 'Copy verse')}
            aria-label={t('نسخ الآية مع التوثيق', 'Copy verse')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-text-secondary hover:text-primary transition"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Optional decorative Bismillah header for Ayah 1 of any Surah except 1 and 9 */}
      {verse.ayahNumber === 1 && verse.surahId !== 1 && verse.surahId !== 9 && (
        <div className="py-2 text-center select-none border-b border-border/40 mb-3" aria-hidden="true">
          <span className="font-quran text-lg md:text-xl text-primary/80 inline-block tracking-wide">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </span>
        </div>
      )}

      {/* Fully diacritized Uthmani Text */}
      <p
        dir="rtl"
        lang="ar"
        className="font-quran text-xl md:text-2xl text-text-primary text-start leading-[2.5] selection:bg-accent-tint py-2"
      >
        {renderVerseContent()}
      </p>

      {/* Neighbor Verses Context Accordion */}
      {showContext && (
        <div
          onClick={e => e.stopPropagation()}
          className="mt-4 pt-4 border-t border-border/80 space-y-3 animate-fade-in text-start cursor-default"
        >
          <div className="flex items-center justify-between text-xs text-text-secondary font-medium">
            <span>{t('سياق الآية في المصحف الشريف:', 'Verse context in the Holy Quran:')}</span>
            {isLoadingContext && <span>{t('جارٍ التحميل...', 'Loading...')}</span>}
          </div>

          {contextData && (
            <div className="space-y-3 bg-background/60 p-3.5 rounded-lg border border-border/70">
              {/* Previous verses */}
              {contextData.beforeVerses?.map(prev => (
                <div key={prev.id} className="text-start opacity-75 hover:opacity-100 transition">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-text-secondary bg-surface px-1.5 py-0.5 rounded border border-border">
                      {t('السابقة', 'Previous')} {isRtl ? toArabicDigits(prev.ayahNumber) : prev.ayahNumber}
                    </span>
                  </div>
                  <p dir="rtl" lang="ar" className="font-quran text-lg md:text-xl text-text-secondary leading-[2.3]">
                    {prev.uthmaniText}{' '}
                    <span className="ayah-number-badge text-text-secondary/70 select-none">
                      {formatAyahOrnament(prev.ayahNumber)}
                    </span>
                  </p>
                </div>
              ))}

              {/* Current Target Verse indicator */}
              <div className="py-1 px-2.5 rounded bg-primary-tint/50 border-s-4 border-primary text-xs font-semibold text-primary">
                {t('الآية الحالية (محل البحث)', 'Current verse')} ({isRtl ? toArabicDigits(verse.ayahNumber) : verse.ayahNumber})
              </div>

              {/* Next verses */}
              {contextData.afterVerses?.map(next => (
                <div key={next.id} className="text-start opacity-75 hover:opacity-100 transition">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-text-secondary bg-surface px-1.5 py-0.5 rounded border border-border">
                      {t('التالية', 'Next')} {isRtl ? toArabicDigits(next.ayahNumber) : next.ayahNumber}
                    </span>
                  </div>
                  <p dir="rtl" lang="ar" className="font-quran text-lg md:text-xl text-text-secondary leading-[2.3]">
                    {next.uthmaniText}{' '}
                    <span className="ayah-number-badge text-text-secondary/70 select-none">
                      {formatAyahOrnament(next.ayahNumber)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
