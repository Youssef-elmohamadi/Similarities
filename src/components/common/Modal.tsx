import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  centeredOnMobile?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  centeredOnMobile = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex justify-center bg-charcoal-900/50 backdrop-blur-xs animate-fade-in',
        centeredOnMobile ? 'items-center p-4' : 'items-end sm:items-center p-0 sm:p-4'
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={cn(
          'relative w-full bg-surface shadow-xl z-10 flex flex-col transition-all',
          centeredOnMobile
            ? 'rounded-xl border border-border max-h-[90vh]'
            : 'rounded-t-2xl sm:rounded-xl border-t sm:border border-border max-h-[85vh] sm:max-h-[90vh]',
          maxWidth === 'sm' && 'max-w-sm',
          maxWidth === 'md' && 'max-w-md',
          maxWidth === 'lg' && 'max-w-lg',
          maxWidth === 'xl' && 'max-w-xl',
          maxWidth === '2xl' && 'max-w-2xl'
        )}
      >
        {/* Mobile Grab Handle for bottom sheet mode */}
        {!centeredOnMobile && (
          <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>
        )}

        {(title || description) && (
          <div className="flex items-start justify-between p-3.5 sm:p-5 border-b border-border shrink-0">
            <div className="pe-4 text-start">
              {title && <h3 className="text-base sm:text-lg font-semibold text-text-primary leading-snug">{title}</h3>}
              {description && <p className="text-xs sm:text-sm text-text-secondary mt-0.5 sm:mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] -me-2 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition shrink-0"
              aria-label="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
