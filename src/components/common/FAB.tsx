import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FABProps {
  onClick?: () => void;
  to?: string;
  icon?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export const FAB: React.FC<FABProps> = ({
  onClick,
  to,
  icon = <Plus className="w-6 h-6" />,
  ariaLabel,
  className,
}) => {
  const baseClasses = cn(
    'fixed bottom-20 end-4 z-20 md:hidden w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary-hover active:scale-95 transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
    className
  );

  if (to) {
    return (
      <Link to={to} className={baseClasses} aria-label={ariaLabel}>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClasses} aria-label={ariaLabel}>
      {icon}
    </button>
  );
};

