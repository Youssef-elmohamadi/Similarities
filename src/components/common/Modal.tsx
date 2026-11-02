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
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-xs animate-fade-in"
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
          'relative w-full bg-surface rounded-xl shadow-xl border border-border overflow-hidden z-10 max-h-[90vh] flex flex-col',
          maxWidth === 'sm' && 'max-w-sm',
          maxWidth === 'md' && 'max-w-md',
          maxWidth === 'lg' && 'max-w-lg',
          maxWidth === 'xl' && 'max-w-xl',
          maxWidth === '2xl' && 'max-w-2xl'
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div className="pe-4 text-start">
              {title && <h3 className="text-lg font-semibold text-text-primary leading-snug">{title}</h3>}
              {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition"
              aria-label="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
};
