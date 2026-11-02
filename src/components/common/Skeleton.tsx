import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-charcoal-200/60', className)}
      {...props}
    />
  );
};

export const VerseCardSkeleton: React.FC = () => {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2 py-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-4/5 ms-auto" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
};

export const CollectionCardSkeleton: React.FC = () => {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
};
