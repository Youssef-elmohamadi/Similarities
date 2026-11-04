import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, BookmarkCheck, PlusSquare, Settings, X, BookOpen, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useChatStatus } from '@/hooks/useAiChat';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { data: chatStatus } = useChatStatus();

  const isChatEnabled = chatStatus?.enabled !== false;

  const navItems = [
    {
      to: '/dashboard',
      label: t('لوحة التحكم', 'Dashboard'),
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/search',
      label: t('البحث القرآني', 'Quran Search'),
      icon: Search,
    },
    {
      to: '/library',
      label: t('مكتبتي الخاصة', 'My Library'),
      icon: BookmarkCheck,
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
      : []),
    {
      to: '/collections/new',
      label: t('إنشاء مجموعة جديدة', 'New Collection'),
      icon: PlusSquare,
    },
    {
      to: '/settings',
      label: t('الإعدادات والملف الشخصي', 'Settings'),
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile backdrop with smooth fade */}
      <div
        className={cn(
          'fixed inset-0 bg-charcoal-900/60 z-50 md:hidden backdrop-blur-sm transition-opacity duration-300 ease-in-out',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer on mobile, sticky sidebar on desktop */}
      <aside
        className={cn(
          'bg-surface border-e border-border flex flex-col justify-between transition-all duration-300 ease-out z-50',
          // Desktop styles:
          'md:sticky md:top-16 md:z-20 md:h-[calc(100vh-4rem)] md:w-64 md:p-4 md:translate-x-0 md:shadow-none',
          // Mobile drawer styles (fullscreen height, elevated shadow, smooth slide from start):
          'fixed top-0 bottom-0 start-0 h-full w-[280px] sm:w-80 p-5 shadow-2xl',
          // Translation classes for mobile based on open state:
          isOpen
            ? 'translate-x-0'
            : '-translate-x-full md:translate-x-0 rtl:translate-x-full rtl:md:translate-x-0'
        )}
      >
        <div className="space-y-6">
          {/* Mobile drawer header */}
          <div className="flex md:hidden items-center justify-between pb-4 border-b border-border/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-text-primary block leading-tight">
                  {t('متشابهات القرآن', 'Quranic Similarities')}
                </span>
                <span className="text-[10px] text-primary font-medium block">
                  {t('منصة الحفاظ الخاصة', 'Memorizer Workspace')}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background border border-border/60 transition"
              aria-label={t('إغلاق القائمة', 'Close menu')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="px-3 py-1 text-xs font-bold text-text-secondary/80 uppercase tracking-wider text-start">
              {t('التنقل', 'Navigation')}
            </div>

            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative text-start',
                      isActive
                        ? 'bg-primary-tint text-primary font-semibold shadow-xs border-s-4 border-primary ps-2.5'
                        : 'text-text-secondary hover:text-text-primary hover:bg-background/80 active:bg-background'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
};
