import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { WordOccurrenceItem } from '@/types/quran';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits } from '@/lib/utils';
import { BookOpen, Search, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';

export interface WordOccurrencesViewProps {
  query: string;
  mode: string;
  wordMatch?: string;
  onSelectWord: (word: string) => void;
}

export const WordOccurrencesView: React.FC<WordOccurrencesViewProps> = ({
  query,
  mode,
  wordMatch = 'smart',
  onSelectWord,
}) => {
  const { t, direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const { data: occurrences, isLoading, error } = useQuery<WordOccurrenceItem[]>({
    queryKey: ['wordOccurrences', query, mode, wordMatch],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await api.get<WordOccurrenceItem[]>(
        `/quran/words/occurrences?q=${encodeURIComponent(query.trim())}&mode=${mode}&wordMatch=${wordMatch}`
      );
      return res.data;
    },
    enabled: !!query.trim(),
  });

  if (!query.trim()) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl">
        <BookOpen className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-50" />
        <p className="text-sm text-text-secondary">
          {t('يرجى كتابة كلمة في حقل البحث لعرض تصريفاتها ومواضع ورودها بالمصحف.', 'Please enter a search keyword to view occurrences.')}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !occurrences || occurrences.length === 0) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-xl">
        <Sparkles className="w-8 h-8 text-accent mx-auto mb-2 opacity-60" />
        <p className="text-base font-semibold text-text-primary mb-1">
          {t('لم نجد تصريفات مطابقة في معجم كلمات المصحف', 'No matching word occurrences found')}
        </p>
        <p className="text-xs text-text-secondary">
          {t('جرّب وضع المتشابهات الإملائية أو ابحث بكلمة مفردة.', 'Try root/spelling similarity mode or single word search.')}
        </p>
      </div>
    );
  }

  const totalOccurrences = occurrences.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4 animate-fade-in text-start">
      <div className="flex items-center justify-between text-xs sm:text-sm text-text-secondary px-1">
        <span>
          {t(
            `وردت الكلمة في ${isRtl ? toArabicDigits(occurrences.length) : occurrences.length} صيغة مختلفة بإجمالي ${isRtl ? toArabicDigits(totalOccurrences) : totalOccurrences} مرة في القرآن الكريم`,
            `Found ${occurrences.length} morphological forms with ${totalOccurrences} total occurrences`
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {occurrences.map((item, idx) => (
          <div
            key={idx}
            onClick={() => onSelectWord(item.originalWord)}
            className="group p-4 bg-surface rounded-xl border border-border hover:border-primary/50 hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-tint text-primary font-medium">
                  {isRtl ? toArabicDigits(item.count) : item.count} {t('مرة', 'times')}
                </span>
                <Search className="w-3.5 h-3.5 text-text-secondary opacity-0 group-hover:opacity-100 transition" />
              </div>

              {/* Uthmani text of the word */}
              <p
                dir="rtl"
                lang="ar"
                className="font-quran text-xl text-text-primary group-hover:text-primary transition py-1 text-center"
              >
                {item.originalWord}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-secondary">
              <span>{t('المجرد:', 'Plain:')} <b className="font-sans text-text-primary">{item.normalizedWord}</b></span>
              <span>{t('الهيكل:', 'Skeleton:')} <b className="font-sans text-text-primary">{item.skeletonWord}</b></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

