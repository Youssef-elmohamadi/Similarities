import React, { useState } from 'react';
import { useVerseLookup } from '@/hooks/useVerseLookup';
import { VerseText } from '@/components/quran/VerseText';
import { BookOpen, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerseTokenChipProps {
  surahNumber: number;
  ayahNumber: number;
  wordRange?: string; // e.g. "3-5" or "4"
}

export const VerseTokenChip: React.FC<VerseTokenChipProps> = ({
  surahNumber,
  ayahNumber,
  wordRange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: verse, isLoading } = useVerseLookup(surahNumber, ayahNumber);

  // Parse word range into 1-based word indices
  const highlightedIndices: number[] = [];
  if (wordRange) {
    if (wordRange.includes('-')) {
      const [startStr, endStr] = wordRange.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        for (let i = start; i <= end; i++) {
          highlightedIndices.push(i);
        }
      }
    } else {
      const single = parseInt(wordRange, 10);
      if (!isNaN(single)) highlightedIndices.push(single);
    }
  }

  const surahLabel = verse?.surahNameArabic || `سورة ${surahNumber}`;

  return (
    <span className={cn('my-1 align-middle', isExpanded ? 'block w-full max-w-full' : 'inline-block')}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer select-none',
          'bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25',
          isExpanded && 'ring-1 ring-primary/40'
        )}
        title={isExpanded ? 'طي نص الآية' : 'عرض نص الآية بالرسم العثماني'}
        aria-expanded={isExpanded}
      >
        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
        <span>{surahLabel}:{ayahNumber}</span>
        {wordRange && (
          <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">
            كلمات {wordRange}
          </span>
        )}
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary ms-0.5" />
        ) : isExpanded ? (
          <ChevronUp className="w-3 h-3 text-primary ms-0.5" />
        ) : (
          <ChevronDown className="w-3 h-3 text-primary ms-0.5" />
        )}
      </button>

      {/* Expanded Verse Box (strictly bounded within container width) */}
      {isExpanded && (
        <div className="block mt-2 mb-2 p-2.5 sm:p-3.5 rounded-xl border border-primary/25 bg-primary/5 dark:bg-primary/10 shadow-xs text-text-primary w-full max-w-full box-border overflow-hidden">
          <div className="flex items-center justify-between gap-1.5 pb-1.5 mb-2 border-b border-primary/15 text-xs text-primary font-semibold flex-wrap">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span>{surahLabel} - الآية {ayahNumber}</span>
            </span>
            {wordRange && (
              <span className="text-[11px] font-normal text-text-muted">
                الكلمات المحددة: ({wordRange})
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>جاري استدعاء نص الآية من المصحف الشريف...</span>
            </div>
          ) : verse ? (
            <div className="text-start leading-[2.4] w-full max-w-full overflow-x-hidden break-words">
              <VerseText
                uthmaniText={verse.uthmaniText}
                ayahNumber={ayahNumber}
                highlightedIndices={highlightedIndices}
                className="text-base md:text-lg"
              />
            </div>
          ) : (
            <div className="text-xs text-red-500 py-1">
              تعذر استرجاع نص الآية، تأكد من الاتصال أو تحميل المصحف محلياً.
            </div>
          )}
        </div>
      )}
    </span>
  );
};

