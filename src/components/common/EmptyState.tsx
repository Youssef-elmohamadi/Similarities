import React from 'react';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-xl border border-dashed border-border bg-surface/70',
        className
      )}
    >
      <div className="w-14 h-14 rounded-xl bg-primary-tint text-primary flex items-center justify-center mb-4 shrink-0">
        {icon || <BookOpen className="w-7 h-7" />}
      </div>
      <h3 className="text-base md:text-lg font-semibold text-text-primary mb-1.5 leading-snug">{title}</h3>
      {description && (
        <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
