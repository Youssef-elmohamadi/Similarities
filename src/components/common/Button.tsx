import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed select-none touch-manipulation',
          // Minimum touch target of 44px on mobile, 40px on desktop
          'min-h-[44px] sm:min-h-[40px]',
          // Variants
          variant === 'primary' &&
            'bg-primary text-white hover:bg-primary-hover active:bg-primary-hover shadow-xs focus-visible:ring-primary',
          variant === 'gold' &&
            'bg-accent text-white hover:bg-accent/90 active:bg-accent shadow-xs focus-visible:ring-accent',
          variant === 'secondary' &&
            'bg-surface text-text-primary border border-border hover:bg-background active:bg-border/30 focus-visible:ring-primary',
          variant === 'outline' &&
            'border border-border bg-surface text-text-primary hover:bg-background active:bg-border/30 focus-visible:ring-primary',
          variant === 'ghost' &&
            'text-text-primary hover:bg-primary-tint/70 active:bg-primary-tint focus-visible:ring-primary',
          variant === 'danger' &&
            'bg-danger text-white hover:bg-danger/90 active:bg-danger shadow-xs focus-visible:ring-danger',
          // Sizes
          size === 'sm' && 'text-xs px-3 py-1.5 gap-1.5 min-h-[38px] sm:min-h-[36px]',
          size === 'md' && 'text-sm px-4 py-2 gap-2',
          size === 'lg' && 'text-base px-5 py-2.5 gap-2.5 min-h-[48px]',
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : icon ? <span className="shrink-0">{icon}</span> : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
