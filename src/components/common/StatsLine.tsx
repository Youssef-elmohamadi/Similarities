import React from 'react';
import { cn, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { CheckCircle2, Loader2, WifiOff, AlertCircle } from 'lucide-react';

export interface StatItem {
  label: string;
  count?: number | string;
}

export interface StatsLineProps {
  items: (StatItem | string)[];
  status?: 'saved' | 'saving' | 'offline' | 'error';
  statusLabel?: string;
  className?: string;
}

export const StatsLine: React.FC<StatsLineProps> = ({
  items,
  status,
  statusLabel,
  className,
}) => {
  const { direction, t } = useLanguage();
  const isRtl = direction === 'rtl';

  const renderStatus = () => {
    if (!status) return null;

    switch (status) {
      case 'saved':
        return (
          <span
            className="inline-flex items-center text-emerald-800 shrink-0"
            title={statusLabel || t('محفوظ ومحدث', 'Saved')}
            aria-label={statusLabel || t('محفوظ ومحدث', 'Saved')}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
        );
      case 'saving':
        return (
          <span
            className="inline-flex items-center text-primary shrink-0 animate-spin"
            title={statusLabel || t('جارٍ الحفظ...', 'Saving...')}
            aria-label={statusLabel || t('جارٍ الحفظ...', 'Saving...')}
          >
            <Loader2 className="w-3.5 h-3.5" />
          </span>
        );
      case 'offline':
        return (
          <span
            className="inline-flex items-center text-amber-800 shrink-0"
            title={statusLabel || t('محفوظ محلياً (بدون اتصال)', 'Saved locally (Offline)')}
            aria-label={statusLabel || t('محفوظ محلياً (بدون اتصال)', 'Saved locally (Offline)')}
          >
            <WifiOff className="w-3.5 h-3.5" />
          </span>
        );
      case 'error':
        return (
          <span
            className="inline-flex items-center text-danger shrink-0"
            title={statusLabel || t('خطأ في الحفظ', 'Save error')}
            aria-label={statusLabel || t('خطأ في الحفظ', 'Save error')}
          >
            <AlertCircle className="w-3.5 h-3.5" />
          </span>
        );
      default:
        return null;
    }
  };

  const formattedItems = items.map(item => {
    if (typeof item === 'string') return item;
    if (item.count !== undefined) {
      const countStr = isRtl ? toArabicDigits(item.count) : item.count;
      return `${countStr} ${item.label}`;
    }
    return item.label;
  });

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-text-secondary font-medium flex-wrap', className)}>
      {renderStatus()}
      {formattedItems.map((text, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-text-secondary/40 select-none">·</span>}
          <span>{text}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

