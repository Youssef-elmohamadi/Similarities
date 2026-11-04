import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface OverflowMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface OverflowMenuProps {
  items: OverflowMenuItem[];
  ariaLabel?: string;
  className?: string;
  align?: 'end' | 'start';
}

export const OverflowMenu: React.FC<OverflowMenuProps> = ({
  items,
  ariaLabel,
  className,
  align = 'end',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();

  const closeMenu = () => setIsOpen(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={cn('relative inline-block', className)} ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel || t('خيارات إضافية', 'More options')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background border border-transparent focus:border-border focus:outline-none transition shrink-0"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          {/* Mobile backdrop for tap outside dismissal */}
          <div
            className="fixed inset-0 z-30 md:hidden bg-black/10 backdrop-blur-[1px]"
            onClick={closeMenu}
            aria-hidden="true"
          />

          <div
            role="menu"
            aria-orientation="vertical"
            className={cn(
              'absolute top-full mt-1.5 z-40 min-w-[180px] bg-surface rounded-xl border border-border shadow-lg py-1 text-start animate-fade-in',
              align === 'end' ? 'end-0' : 'start-0'
            )}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  closeMenu();
                  item.onClick();
                }}
                className={cn(
                  'w-full min-h-[44px] px-3.5 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium transition text-start',
                  item.variant === 'danger'
                    ? 'text-danger hover:bg-danger-subtle'
                    : 'text-text-primary hover:bg-background',
                  item.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent'
                )}
              >
                {item.icon && <span className="w-4 h-4 shrink-0 text-current">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

