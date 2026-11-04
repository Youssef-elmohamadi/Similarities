import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { StatsLine, StatItem } from './StatsLine';
import { OverflowMenu, OverflowMenuItem } from './OverflowMenu';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  // Enhanced mobile density props
  backHref?: string;
  onBack?: () => void;
  stats?: (StatItem | string)[];
  status?: 'saved' | 'saving' | 'offline' | 'error';
  statusLabel?: string;
  overflowItems?: OverflowMenuItem[];
  compactMobile?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className,
  backHref,
  onBack,
  stats,
  status,
  statusLabel,
  overflowItems,
  compactMobile = true,
}) => {
  const { direction, t } = useLanguage();
  const isRtl = direction === 'rtl';
  const navigate = useNavigate();
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      navigate(backHref);
    }
  };

  const hasBack = Boolean(backHref || onBack);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  return (
    <>
      {/* ========================================================= */}
      {/* Desktop Header (>= 768px): 100% Unchanged Layout          */}
      {/* ========================================================= */}
      <div
        className={cn(
          'hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60',
          className
        )}
      >
        <div className="space-y-1 text-start">
          <div className="flex items-center gap-2.5 flex-wrap">
            {hasBack && (
              <button
                type="button"
                onClick={handleBack}
                aria-label={t('رجوع', 'Back')}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-background transition"
              >
                <BackIcon className="w-4 h-4" />
              </button>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary leading-snug tracking-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <p className="text-sm md:text-base text-text-secondary leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* Mobile Compact Header (< 768px): Density & Calm Token     */}
      {/* ========================================================= */}
      {compactMobile ? (
        <div
          className={cn(
            'md:hidden flex flex-col p-3 rounded-xl border border-border bg-surface shadow-none text-start space-y-2',
            className
          )}
        >
          {/* Row 1: Back, Title, Badge, OverflowMenu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {hasBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={t('رجوع', 'Back')}
                  className="min-w-[44px] min-h-[44px] -ms-2 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition shrink-0"
                >
                  <BackIcon className="w-5 h-5" />
                </button>
              )}
              <h1
                className="text-base font-bold text-text-primary truncate"
                title={title}
              >
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {overflowItems && overflowItems.length > 0 && (
                <OverflowMenu items={overflowItems} />
              )}
              {!overflowItems && actions && (
                <div className="flex items-center gap-1.5">{actions}</div>
              )}
            </div>
          </div>

          {/* Row 2: One-line expandable description */}
          {description && (
            <p
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className={cn(
                'text-xs text-text-secondary leading-relaxed transition cursor-pointer select-none',
                !isDescExpanded && 'line-clamp-1'
              )}
              title={description}
            >
              {description}
            </p>
          )}

          {/* Row 3: Single Muted Inline Stats Line with Saved Dot */}
          {(stats && stats.length > 0 || status) && (
            <div className="pt-0.5 border-t border-border/40">
              <StatsLine
                items={stats || []}
                status={status}
                statusLabel={statusLabel}
              />
            </div>
          )}
        </div>
      ) : (
        /* Legacy fallback if compactMobile is false */
        <div className={cn('md:hidden flex flex-col gap-2 pb-2 border-b border-border', className)}>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-xs text-text-secondary">{description}</p>}
          {actions}
        </div>
      )}
    </>
  );
};
