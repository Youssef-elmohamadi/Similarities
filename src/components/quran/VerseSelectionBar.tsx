import React from 'react';
import { Button } from '@/components/common/Button';
import { PlusCircle, Trash2 } from 'lucide-react';
import { toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface VerseSelectionBarProps {
  selectedCount: number;
  onCreateCollection: () => void;
  onClearSelection: () => void;
}

export const VerseSelectionBar: React.FC<VerseSelectionBarProps> = ({
  selectedCount,
  onCreateCollection,
  onClearSelection,
}) => {
  const { t, direction } = useLanguage();

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-4 sm:inset-x-auto sm:end-8 z-40 animate-slide-up">
      <div className="bg-text-primary text-white px-4 sm:px-5 py-3 rounded-xl shadow-card flex items-center justify-between sm:justify-start gap-3 sm:gap-4 border border-charcoal-700">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
            {direction === 'rtl' ? toArabicDigits(selectedCount) : selectedCount}
          </span>
          <span className="text-xs sm:text-sm font-medium">
            {t(
              `تم تحديد ${toArabicDigits(selectedCount)} آيات`,
              `${selectedCount} verse${selectedCount > 1 ? 's' : ''} selected`
            )}
          </span>
        </div>

        <div className="h-5 w-px bg-charcoal-700 shrink-0" />

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="gold"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={onCreateCollection}
          >
            {t('إنشاء مجموعة متشابهات', 'Create Collection')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearSelection}
            className="text-charcoal-300 hover:text-white hover:bg-charcoal-800 p-2 min-h-[36px]"
            title={t('مسح التحديد', 'Clear Selection')}
            aria-label={t('مسح التحديد', 'Clear Selection')}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
