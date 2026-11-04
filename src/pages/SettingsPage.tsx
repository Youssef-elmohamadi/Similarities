import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePwa } from '@/context/PwaContext';
import { useToast } from '@/components/common/Toast';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { PageHeader } from '@/components/common/PageHeader';
import { ListRow } from '@/components/common/ListRow';
import { SyncStatusPanel } from '@/components/settings/SyncStatusPanel';
import { Seo } from '@/components/common/Seo';
import { User, Globe, ShieldCheck, Database, LogOut, Smartphone, Check, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStorageReport, requestPersistentStorage, formatBytes, StorageReport } from '@/offline/storageManager';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { isInstallable, isIOS, installApp } = usePwa();
  const toast = useToast();
  const navigate = useNavigate();

  const [storageReport, setStorageReport] = useState<StorageReport | null>(null);
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);

  useEffect(() => {
    let mounted = true;
    getStorageReport().then(report => {
      if (mounted) setStorageReport(report);
      // Auto-request persistence if supported and not yet granted
      if (report.supported && !report.isPersisted) {
        requestPersistentStorage().then(res => {
          if (res.persisted && mounted) {
            getStorageReport().then(r => mounted && setStorageReport(r));
          }
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRequestPersist = async () => {
    setIsRequestingPersist(true);
    const res = await requestPersistentStorage();
    setIsRequestingPersist(false);
    if (res.persisted) {
      toast.success(t('تم تفعيل التخزين الدائم بنجاح.', 'Persistent storage enabled successfully.'));
      const r = await getStorageReport();
      setStorageReport(r);
    } else {
      toast.info(res.reason || t('تعذر تفعيل التخزين الدائم.', 'Failed to enable persistent storage.'));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 pb-20 text-start animate-fade-in">
      <Seo title="الإعدادات" robots="noindex, nofollow" />

      {/* Header (Desktop + Compact Mobile) */}
      <PageHeader
        title={t('الملف الشخصي والإعدادات', 'Profile & Settings')}
        description={t(
          'بيانات الحساب وتفضيلات المنصة وضمانات الخصوصية التامة ومصدر البيانات القرآنية.',
          'Account details, interface preferences, privacy guarantees, and Quranic data source.'
        )}
      />

      {/* PWA App Installation Card (if available) */}
      {(isInstallable || isIOS) && (
        <Card className="space-y-2 md:space-y-3 border-primary/40 bg-primary-tint/20 p-3 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-xs md:text-base text-text-primary flex items-center gap-1.5 md:gap-2">
              <Smartphone className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <span>{t('تثبيت التطبيق على جهازك', 'Install App on Your Device')}</span>
            </h2>
            <Button size="sm" variant="primary" onClick={installApp} className="flex items-center gap-1.5 min-h-[38px] text-xs">
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t('ثبّت التطبيق', 'Install App')}</span>
            </Button>
          </div>
          <p className="text-xs md:text-sm text-text-secondary leading-relaxed">
            {t(
              'يمكنك تثبيت منصة متشابهات القرآن كتطبيق متكامل وسريع على هاتفك أو حاسوبك، للعمل والبحث في المصحف بدون الحاجة لإنترنت.',
              'Install Quran Similarities as a standalone app on your phone or PC for fast, offline Quran search anytime.'
            )}
          </p>
        </Card>
      )}

      {/* ========================================================= */}
      {/* Desktop Settings Layout (>= 768px): 100% Unchanged         */}
      {/* ========================================================= */}
      <div className="hidden md:block space-y-6">
        {/* User Info Card */}
        <Card className="space-y-4">
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <span>{t('معلومات المستخدم', 'User Information')}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
            <div className="p-4 rounded-xl bg-background border border-border">
              <span className="text-text-secondary block mb-1 text-xs">{t('الاسم الكامل', 'Full Name')}</span>
              <span className="font-semibold text-text-primary text-base">
                <bdi>{user?.fullName}</bdi>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border">
              <span className="text-text-secondary block mb-1 text-xs">{t('البريد الإلكتروني', 'Email')}</span>
              <span className="font-semibold text-text-primary text-base" dir="ltr">
                {user?.email}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              icon={<LogOut className="w-4 h-4 text-danger" />}
              className="text-danger hover:bg-danger-subtle hover:text-danger min-h-[40px]"
            >
              {t('تسجيل الخروج من الحساب', 'Sign Out')}
            </Button>
          </div>
        </Card>

        {/* Sync Status & Offline Queue Management */}
        <SyncStatusPanel />

        {/* Language Preference Card */}
        <Card className="space-y-4">
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <span>{t('لغة واجهة التطبيق', 'Interface Language')}</span>
          </h2>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-background border border-border">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {language === 'ar' ? 'العربية (افتراضي)' : 'English'}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {language === 'ar'
                  ? 'واجهة عربية من اليمين إلى اليسار (RTL)'
                  : 'English Left-to-Right interface (LTR)'}
              </p>
            </div>

            <Button size="sm" variant="outline" onClick={toggleLanguage} className="min-h-[40px]">
              {language === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
            </Button>
          </div>
        </Card>

        {/* Privacy & Data Isolation */}
        <Card className="space-y-3">
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>{t('الخصوصية وعزل البيانات', 'Privacy & Data Security')}</span>
          </h2>

          <p className="text-sm text-text-secondary leading-relaxed">
            {t(
              'جميع مجموعات المتشابهات والمقارنات وروابط الحفظ والملاحظات المسجلة بحسابك خاصة تماماً ومحمية على مستوى الخادم وقاعدة البيانات، ولا يمكن لأي مستخدم آخر الوصول إليها أو الاطلاع عليها.',
              'All your collections, comparisons, notes, and links are completely private and enforced at the server and database level.'
            )}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="primary">
              {t('حساب مستقل ومحمي', 'Private & Isolated Account')}
            </Badge>
            <Badge variant="charcoal">
              {t('خالٍ من الإعلانات والتتبع', 'No Ads or Tracking')}
            </Badge>
            <Badge variant="accent">
              {t('توثيق بشري بدون توليد آلي', 'Human-Centered Memorization')}
            </Badge>
          </div>
        </Card>

        {/* Quran Data Source & Tanzil Attribution */}
        <Card className="space-y-3">
          <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <span>{t('مصدر النص القرآني', 'Quran Text Source')}</span>
          </h2>

          <p className="text-sm text-text-secondary leading-relaxed">
            {t(
              'يعتمد التطبيق النص القرآني المعتمد والمضبوط بالرسم العثماني من مشروع تنزيل (Tanzil Project)، ويشمل كامل السور (114 سورة) والآيات (6236 آية) برسم مصحف المدينة النبوية.',
              'The application uses the authentic Medina Uthmani Quranic text from the Tanzil Project, encompassing all 114 Surahs and 6,236 Ayahs with full diacritics.'
            )}
          </p>

          <div className="pt-1">
            <a
              href="https://tanzil.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>tanzil.net - The Tanzil Project</span>
            </a>
          </div>
        </Card>

        {/* Storage Persistence & Capacity Report (Desktop) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-base text-text-primary flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              <span>{t('المساحة التخزينية وحماية البيانات', 'Storage & Persistence')}</span>
            </h2>
            {storageReport?.isPersisted ? (
              <Badge variant="primary" className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>{t('محفوظ ضد الحذف التلقائي', 'Persistent')}</span>
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRequestPersist}
                disabled={isRequestingPersist || !storageReport?.supported}
                className="text-xs"
              >
                {t('تفعيل التخزين الدائم', 'Enable Persistence')}
              </Button>
            )}
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
            {storageReport?.isPersisted
              ? t(
                  'بيانات المصحف الشريف ومجموعاتك الشخصية محمية ضد الحذف التلقائي من قبل المتصفح حتى في حالات امتلاء الذاكرة.',
                  'Your Quran dataset and personal collections are protected against automatic browser eviction.'
                )
              : t(
                  'التخزين الدائم يضمن عدم قيام المتصفح بحذف المصحف والمجموعات المحفوظة عند انخفاض مساحة الهاتف.',
                  'Persistent storage prevents the browser from evicting offline data under low storage.'
                )}
          </p>

          {storageReport && (
            <div className="p-3 bg-background rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between text-text-secondary">
                <span>{t('المساحة المستخدمة', 'Storage Used')}</span>
                <span className="font-medium text-text-primary">
                  {storageReport.usageMB} MB {storageReport.quotaMB > 0 ? `(${storageReport.percent}%)` : ''}
                </span>
              </div>
              {storageReport.quotaMB > 0 && (
                <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(1, storageReport.percent))}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ========================================================= */}
      {/* Mobile Settings Layout (< 768px): Calm, High-Density      */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-3">
        {/* User Account Details Section */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary uppercase px-1">
            {t('بيانات الحساب', 'Account Details')}
          </span>
          <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
            <div className="min-h-[48px] px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{t('الاسم الكامل', 'Full Name')}</span>
              <span className="text-xs font-semibold text-text-primary"><bdi>{user?.fullName}</bdi></span>
            </div>
            <div className="min-h-[48px] px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-text-secondary">{t('البريد الإلكتروني', 'Email')}</span>
              <span className="text-xs font-semibold text-text-primary" dir="ltr">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Sync Status Panel */}
        <SyncStatusPanel />

        {/* Storage Persistence & Capacity Report (Mobile) */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary uppercase px-1">
            {t('التخزين والمساحة', 'Storage & Persistence')}
          </span>
          <div className="p-3 border border-border rounded-xl bg-surface space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <HardDrive className="w-4 h-4 text-primary" />
                <span>{t('حماية البيانات من الحذف', 'Persistence')}</span>
              </div>
              {storageReport?.isPersisted ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{t('محفوظ دائم', 'Persisted')}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPersist}
                  disabled={isRequestingPersist || !storageReport?.supported}
                  className="text-[11px] font-medium text-primary bg-primary-tint/50 px-2 py-1 rounded-lg border border-primary/30 active:scale-95 transition"
                >
                  {t('تفعيل التخزين', 'Enable')}
                </button>
              )}
            </div>

            {storageReport && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-text-secondary">
                  <span>{t('المستخدم:', 'Used:')} {storageReport.usageMB} MB</span>
                  {storageReport.quotaMB > 0 && <span>{formatBytes(storageReport.quotaBytes)}</span>}
                </div>
                {storageReport.quotaMB > 0 && (
                  <div className="w-full bg-border/60 rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(1, storageReport.percent))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary uppercase px-1">
            {t('تفضيلات التطبيق', 'Preferences')}
          </span>
          <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
            <div className="min-h-[52px] px-3 py-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary block">
                  {t('لغة الواجهة', 'Language')}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {language === 'ar' ? 'العربية' : 'English'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleLanguage}
                className="min-h-[40px] px-3 py-1 text-xs font-medium rounded-lg border border-border bg-background hover:bg-surface text-text-primary transition"
              >
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          </div>
        </div>

        {/* Privacy & Source Section (Compact Accordions) */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-text-secondary uppercase px-1">
            {t('المعلومات والخصوصية', 'Information & Privacy')}
          </span>
          <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
            <div className="p-3 space-y-1.5 text-xs text-text-secondary leading-relaxed">
              <div className="flex items-center gap-1.5 text-text-primary font-semibold">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{t('الخصوصية وعزل البيانات', 'Privacy')}</span>
              </div>
              <p>
                {t(
                  'بياناتك ومجموعاتك وملاحظاتك خاصة تماماً ومحمية بحسابك، ولا يمكن لأي مستخدم آخر الاطلاع عليها.',
                  'Your collections and notes are strictly private to your account.'
                )}
              </p>
            </div>

            <div className="p-3 space-y-1.5 text-xs text-text-secondary leading-relaxed">
              <div className="flex items-center gap-1.5 text-text-primary font-semibold">
                <Database className="w-4 h-4 text-primary" />
                <span>{t('مصدر النص القرآني', 'Quran Text')}</span>
              </div>
              <p>
                {t(
                  'النص القرآني بالرسم العثماني برواية حفص من مشروع تنزيل (Tanzil Project).',
                  'Uthmani text by Tanzil Project.'
                )}
              </p>
              <a
                href="https://tanzil.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline inline-block"
              >
                tanzil.net
              </a>
            </div>
          </div>
        </div>

        {/* Logout Button (At the bottom) */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-danger/30 bg-danger-subtle/40 text-danger hover:bg-danger-subtle font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('تسجيل الخروج من الحساب', 'Sign Out')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
