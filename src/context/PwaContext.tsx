import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X, Smartphone } from 'lucide-react';
import { useLanguage } from './LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaContextType {
  isInstallable: boolean;
  isIOS: boolean;
  installApp: () => Promise<void>;
  offlineReady: boolean;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: false,
    onRegistered(r?: ServiceWorkerRegistration) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error: unknown) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    // Check if running on iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone;
    
    setIsIOS(isIosDevice && !isStandalone);

    if (typeof window !== 'undefined') {
      (window as any).__triggerPwaUpdateToast = () => setNeedRefresh(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      // Show banner if not dismissed before
      const dismissed = localStorage.getItem('pwa_install_banner_dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstallable(false);
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIosModal(true);
    }
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_banner_dismissed', 'true');
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isIOS,
        installApp,
        offlineReady,
        needRefresh,
        updateServiceWorker,
      }}
    >
      {children}

      {/* SW Update Toast Notification */}
      {needRefresh && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 z-50 max-w-sm mx-auto sm:mx-0 bg-surface p-4 rounded-xl border border-border shadow-xl flex items-start justify-between gap-3 animate-fade-in text-start mb-safe"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0 mt-0.5">
              <RefreshCw className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-sm font-bold text-text-primary leading-snug">
                {t('تحديث جديد متوفر!', 'New update available!')}
              </p>
              <p className="text-xs text-text-secondary leading-relaxed break-words">
                {t(
                  'يتوفر إصدار جديد من المنصة مع تحسينات ومزايا إضافية.',
                  'A new app version is ready with fresh updates.'
                )}
              </p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateServiceWorker(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover transition shadow-sm"
                >
                  {t('تحديث', 'Update')}
                </button>
                <button
                  type="button"
                  onClick={() => setNeedRefresh(false)}
                  className="px-2.5 py-1.5 rounded-lg text-text-secondary hover:text-text-primary text-xs transition"
                >
                  {t('لاحقاً', 'Later')}
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="p-1.5 -me-1 -mt-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-charcoal-100 transition shrink-0"
            title={t('إغلاق', 'Dismiss')}
            aria-label={t('إغلاق', 'Dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dismissible Install Banner */}
      {showInstallBanner && isInstallable && (
        <div className="fixed top-16 start-4 end-4 md:start-auto md:end-6 md:w-96 z-40 bg-surface p-3.5 rounded-xl border border-border shadow-lg flex items-center justify-between gap-3 animate-fade-in text-start">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs font-bold text-text-primary truncate">
                {t('تثبيت تطبيق متشابهات القرآن', 'Install Quran Similarities App')}
              </p>
              <p className="text-[11px] text-text-secondary truncate">
                {t('للوصول السريع والعمل بدون اتصال بالإنترنت', 'Quick access & offline search')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={installApp}
              className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition"
            >
              {t('تثبيت', 'Install')}
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1 text-text-secondary hover:text-text-primary rounded-md"
              aria-label={t('إغلاق', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Install Guide Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-2xl max-w-sm w-full space-y-4 text-center border border-border shadow-xl">
            <div className="w-12 h-12 rounded-full bg-primary-tint text-primary mx-auto flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">
              {t('تثبيت التطبيق على آيفون / آيباد', 'Install on iOS')}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed text-start">
              {t(
                'لتثبيت التطبيق على الشاشة الرئيسية لأجهزة iOS: اضغط على زر المشاركة (Share) في أسفل المتصفح، ثم اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).',
                'To install on iOS: tap the Share button in Safari, then select "Add to Home Screen".'
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition"
            >
              {t('حسناً، فهمت', 'Got it')}
            </button>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
