import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useDataset } from '@/context/DatasetContext';
import { BookOpen, LogOut, Globe, Menu, X, PlusCircle, User, Settings, WifiOff, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { isOffline, isOfflineReady } = useDataset();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isCollectionDetailPage = location.pathname.startsWith('/collections/') && location.pathname !== '/collections/new';

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border h-14 md:h-16 transition-colors">
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-6xl mx-auto">
        {/* Start: Brand & Mobile Sidebar Toggle */}
        <div className="flex items-center gap-3">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition"
              aria-label={isSidebarOpen ? t('إغلاق القائمة', 'Close menu') : t('فتح القائمة', 'Open menu')}
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}

          <Link to="/dashboard" className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs group-hover:bg-primary-hover transition-colors shrink-0">
              <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className={cn(isCollectionDetailPage ? 'hidden md:block' : 'hidden sm:block')}>
              <span className="font-bold text-sm md:text-base text-text-primary leading-tight block">
                {t('متشابهات القرآن', 'Quranic Similarities')}
              </span>
              <span className="text-[10px] md:text-[11px] text-primary font-medium hidden sm:block">
                {t('منصة الحفاظ الخاصة', 'Memorizer Workspace')}
              </span>
            </div>
          </Link>
        </div>

        {/* End: Actions, Language & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Online / Offline Status Badge */}
          {isOffline ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-danger-subtle text-danger border border-danger/20"
              title={t('أنت تعمل في وضع عدم الاتصال', 'You are currently offline')}
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('بدون إنترنت', 'Offline')}</span>
            </span>
          ) : isOfflineReady ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-tint text-primary border border-primary/20"
              title={t('المصحف محفوظ محلياً ويعمل بدون إنترنت', 'Quran is cached locally and works offline')}
            >
              <CheckCircle2 className="w-3 h-3 text-primary" />
              <span className="hidden sm:inline">{t('جاهز محلياً', 'Local Ready')}</span>
            </span>
          ) : null}

          <Link
            to="/collections/new"
            aria-label={t('مجموعة جديدة', 'New Collection')}
            className="hidden sm:inline-flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-lg bg-primary-tint text-primary hover:bg-primary-tint/80 border border-primary/20 text-xs font-semibold transition min-h-[44px] min-w-[44px] justify-center"
          >
            <PlusCircle className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">{t('مجموعة جديدة', 'New Collection')}</span>
          </Link>

          {/* Language Switch */}
          <button
            onClick={toggleLanguage}
            aria-label={t('تغيير اللغة', 'Toggle Language')}
            className="min-h-[44px] min-w-[44px] p-2 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-background border border-border transition"
            title={t('تغيير اللغة', 'Toggle Language')}
          >
            <Globe className="w-4 h-4 text-text-secondary" />
            <span className="hidden sm:inline">{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* User Menu */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-2 p-1 rounded-lg hover:bg-background border border-transparent hover:border-border transition text-start"
                aria-expanded={isUserMenuOpen}
                aria-label={t('قائمة المستخدم', 'User Menu')}
              >
                <div className="w-8 h-8 rounded-full bg-primary-tint text-primary flex items-center justify-center font-bold text-xs border border-primary/20">
                  {(user.fullName || user.email || 'U').charAt(0)}
                </div>
                <span className="hidden md:block text-xs font-semibold text-text-primary max-w-[120px] truncate">
                  <bdi>{user.fullName || user.email}</bdi>
                </span>
              </button>

              {isUserMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsUserMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute end-0 mt-2 w-56 bg-surface rounded-xl shadow-card border border-border py-1.5 z-50 text-xs animate-fade-in text-start">
                    <div className="px-4 py-2.5 border-b border-border/80">
                      <p className="font-semibold text-text-primary truncate">
                        <bdi>{user.fullName}</bdi>
                      </p>
                      <p className="text-[11px] text-text-secondary truncate mt-0.5" dir="ltr">
                        {user.email}
                      </p>
                    </div>

                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-background transition"
                    >
                      <Settings className="w-4 h-4 text-text-secondary" />
                      <span>{t('الإعدادات والملف الشخصي', 'Settings & Profile')}</span>
                    </Link>

                    <div className="border-t border-border/80 my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-danger hover:bg-danger-subtle transition text-start font-medium"
                    >
                      <LogOut className="w-4 h-4 text-danger" />
                      <span>{t('تسجيل الخروج', 'Log Out')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
