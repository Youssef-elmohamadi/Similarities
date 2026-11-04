import React from 'react';
import { cn, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface TabItem {
  id: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
}

export interface SegmentedTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  sticky?: boolean;
}

export const SegmentedTabs: React.FC<SegmentedTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className,
  sticky = true,
}) => {
  const { direction } = useLanguage();
  const isRtl = direction === 'rtl';

  return (
    <div
      className={cn(
        'w-full py-1 bg-background/95 backdrop-blur-xs transition-colors',
        sticky && 'sticky top-14 z-20',
        className
      )}
    >
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex items-center gap-1 p-1 bg-surface border border-border rounded-xl overflow-x-auto scrollbar-none h-11"
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const countDisplay = tab.count !== undefined
            ? ` (${isRtl ? toArabicDigits(tab.count) : tab.count})`
            : '';

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex-1 min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition touch-manipulation',
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background'
              )}
            >
              {tab.icon && <span className="w-3.5 h-3.5 shrink-0">{tab.icon}</span>}
              <span>
                {tab.label}
                {countDisplay && (
                  <span className={cn('text-[11px] font-normal ms-0.5', isActive ? 'text-white/85' : 'text-text-secondary/80')}>
                    {countDisplay}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

