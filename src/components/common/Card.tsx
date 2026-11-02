import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable = false, children, ...props }) => {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border p-5 md:p-6 shadow-xs transition duration-150',
        hoverable && 'hover:border-primary/40 hover:shadow-sm cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
