import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, BookmarkCheck, PlusSquare, Settings } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';

export const BottomNav: React.FC = () => {
  const { t } = useLanguage();

  const navItems = [
    {
      to: '/',
      label: t('الرئيسية', 'Home'),
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/search',
      label: t('البحث', 'Search'),
      icon: Search,
    },
    {
      to: '/library',
      label: t('مكتبتي', 'Library'),
      icon: BookmarkCheck,
    },
    {
      to: '/collections/new',
      label: t('جديدة', 'New'),
      icon: PlusSquare,
    },
    {
      to: '/settings',
      label: t('إعدادات', 'Settings'),
      icon: Settings,
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label={t('التنقل السفلي للهاتف', 'Mobile Bottom Navigation')}
      className="md:hidden fixed bottom-0 start-0 end-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border shadow-card pb-safe"
    >
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors touch-manipulation',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                )
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="truncate max-w-[56px]">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

