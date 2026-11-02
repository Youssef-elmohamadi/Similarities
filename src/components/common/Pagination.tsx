import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './Button';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits } from '@/lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className,
}) => {
  const { t, direction } = useLanguage();

  if (totalPages <= 1) return null;

  const isRtl = direction === 'rtl';

  return (
    <nav
      role="navigation"
      aria-label={t('التنقل بين الصفحات', 'Pagination Navigation')}
      className={`flex items-center justify-between gap-4 py-4 px-2 ${className || ''}`}
    >
      <div className="text-sm text-text-secondary font-medium">
        <span>{t('صفحة', 'Page')} </span>
        <span className="font-semibold text-text-primary">
          {isRtl ? toArabicDigits(currentPage) : currentPage}
        </span>
        <span> {t('من', 'of')} </span>
        <span className="font-semibold text-text-primary">
          {isRtl ? toArabicDigits(totalPages) : totalPages}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || disabled}
          aria-label={t('الصفحة السابقة', 'Previous page')}
          icon={isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        >
          {t('السابق', 'Previous')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || disabled}
          aria-label={t('الصفحة التالية', 'Next page')}
          icon={isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        >
          {t('التالي', 'Next')}
        </Button>
      </div>
    </nav>
  );
};

