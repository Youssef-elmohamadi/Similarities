import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, BookmarkCheck, PlusSquare, Settings, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useChatStatus } from '@/hooks/useAiChat';
import { cn } from '@/lib/utils';

export const BottomNav: React.FC = () => {
  const { t } = useLanguage();
  const { data: chatStatus } = useChatStatus();

  const isChatEnabled = chatStatus?.enabled !== false;

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
    ...(isChatEnabled
      ? [
          {
            to: '/chat',
            label: t('المساعد', 'Assistant'),
            badge: t('تجريبي', 'Beta'),
            icon: Sparkles,
          },
        ]
      : [
          {
            to: '/collections/new',
            label: t('جديدة', 'New'),
            icon: PlusSquare,
          },
        ]),
    {
      to: '/library',
      label: t('مكتبتي', 'Library'),
      icon: BookmarkCheck,
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
      <div className="grid grid-cols-5 h-14 max-w-lg mx-auto px-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const hasBadge = 'badge' in item && Boolean(item.badge);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-medium transition-colors touch-manipulation min-h-[44px] relative',
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                )
              }
            >
              <div className="relative">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                {hasBadge && (
                  <span className="absolute -top-1 -end-2 px-1 py-0.2 rounded-full text-[8px] font-bold bg-amber-500 text-white leading-none">
                    تجريبي
                  </span>
                )}
              </div>
              <span className="truncate max-w-[56px] leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

