import React from 'react';
import { cn, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface SectionToolbarProps {
  title: string;
  count?: number | string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'ghost' | 'outline' | 'primary';
  };
  extraActions?: React.ReactNode;
  className?: string;
}

export const SectionToolbar: React.FC<SectionToolbarProps> = ({
  title,
  count,
  icon,
  action,
  extraActions,
  className,
}) => {
  const { direction } = useLanguage();
  const isRtl = direction === 'rtl';

  return (
    <div className={cn('flex items-center justify-between gap-2 py-1', className)}>
      {/* Title & Count */}
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="w-4 h-4 text-primary shrink-0">{icon}</span>}
        <h2 className="text-sm md:text-base font-semibold text-text-primary truncate">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-xs text-text-secondary font-normal shrink-0">
            ({isRtl ? toArabicDigits(count) : count})
          </span>
        )}
      </div>

      {/* Action / Toggle */}
      <div className="flex items-center gap-1.5 shrink-0">
        {extraActions}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'min-h-[44px] px-2.5 py-1 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition touch-manipulation',
              action.variant === 'primary'
                ? 'bg-primary text-white hover:bg-primary-hover'
                : action.variant === 'outline'
                ? 'border border-border bg-surface text-text-primary hover:bg-background'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface border border-transparent hover:border-border'
            )}
          >
            {action.icon && <span className="w-3.5 h-3.5">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </div>
  );
};

