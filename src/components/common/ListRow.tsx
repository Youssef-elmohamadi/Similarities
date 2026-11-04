import React from 'react';
import { cn, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ListRowProps {
  id?: string;
  index?: number | string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  id,
  index,
  icon,
  title,
  subtitle,
  meta,
  badge,
  actions,
  isExpanded = false,
  onToggleExpand,
  onClick,
  children,
  className,
}) => {
  const { direction } = useLanguage();
  const isRtl = direction === 'rtl';

  const isAccordion = Boolean(children && onToggleExpand);
  const isClickable = Boolean(onClick || isAccordion);

  const handleRowClick = (e: React.MouseEvent) => {
    // Prevent toggle if clicking interactive child elements (links, buttons, inputs)
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [data-prevent-row-click]')) {
      return;
    }
    if (onToggleExpand) {
      onToggleExpand();
    } else if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onToggleExpand) {
        onToggleExpand();
      } else if (onClick) {
        onClick();
      }
    }
  };

  return (
    <div className={cn('bg-surface transition-colors', className)}>
      <div
        id={id}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : undefined}
        aria-expanded={isAccordion ? isExpanded : undefined}
        onClick={isClickable ? handleRowClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        className={cn(
          'min-h-[52px] py-2 px-3 flex items-center justify-between gap-2.5 transition select-none',
          isClickable && 'cursor-pointer hover:bg-background/80 active:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
        )}
      >
        {/* Start: Index / Icon + Title & Subtitle */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {index !== undefined && (
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
              {isRtl && typeof index === 'number' ? toArabicDigits(index) : index}
            </span>
          )}

          {icon && (
            <span className="w-6 h-6 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0">
              {icon}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-text-primary truncate block">
                {title}
              </span>
              {badge}
            </div>

            {(subtitle || meta) && (
              <div className="flex items-center gap-2 text-[11px] text-text-secondary truncate mt-0.5">
                {subtitle && <span className="truncate">{subtitle}</span>}
                {subtitle && meta && <span className="text-text-secondary/40 select-none">·</span>}
                {meta && <span className="shrink-0">{meta}</span>}
              </div>
            )}
          </div>
        </div>

        {/* End: Actions & Accordion Toggle */}
        <div className="flex items-center gap-1 shrink-0" data-prevent-row-click>
          {actions}

          {isAccordion && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              aria-label={isExpanded ? 'طي التفاصيل' : 'عرض التفاصيل'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Accordion Panel */}
      {isAccordion && isExpanded && (
        <div
          role="region"
          aria-labelledby={id}
          className="px-3 pb-3 pt-1 border-t border-border/40 bg-background/30 transition-all duration-150 animate-fade-in"
        >
          {children}
        </div>
      )}
    </div>
  );
};

