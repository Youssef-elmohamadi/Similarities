import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'emerald' | 'gold' | 'accent' | 'charcoal' | 'outline' | 'blue' | 'danger' | 'success';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full select-none transition-colors leading-none',
        // Variants
        (variant === 'primary' || variant === 'emerald') &&
          'bg-primary-tint text-primary border border-primary/20',
        (variant === 'gold' || variant === 'accent') &&
          'bg-accent-tint text-accent border border-accent/20',
        variant === 'charcoal' &&
          'bg-charcoal-100 text-text-primary border border-border',
        variant === 'outline' &&
          'border border-border text-text-secondary bg-surface',
        variant === 'blue' &&
          'bg-sky-50 text-sky-800 border border-sky-200',
        variant === 'danger' &&
          'bg-danger-subtle text-danger border border-danger/20',
        variant === 'success' &&
          'bg-success-subtle text-success border border-success/20',
        // Sizes
        size === 'sm' && 'text-xs px-2.5 py-1 gap-1',
        size === 'md' && 'text-xs px-3 py-1.5 gap-1.5',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
