import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { landingTranslations } from '@/i18n/landingTranslations';
import { WHATSAPP_NUMBER, APP_VERSION, getWhatsAppUrl, formatWhatsAppDisplay } from '@/config/appConfig';
import { ExternalLink, MessageCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/offline/connectivity';

export interface AppFooterProps {
  className?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ className }) => {
  const { language } = useLanguage();
  const tData = landingTranslations[language].footer;
  const isOnline = useNetworkStatus();
  const isOffline = !isOnline;

  const hasWhatsApp = Boolean(WHATSAPP_NUMBER && WHATSAPP_NUMBER.length > 0);
  const whatsappUrl = hasWhatsApp ? getWhatsAppUrl(tData.whatsappPrefilledMessage) : '';
  const formattedNumber = formatWhatsAppDisplay(WHATSAPP_NUMBER);

  return (
    <footer
      role="contentinfo"
      className={cn(
        'w-full border-t border-border text-text-secondary text-sm py-6 px-4 sm:px-6 lg:px-8 transition-colors',
        className
      )}
    >
      <div className="max-w-6xl mx-auto flex flex-col items-center justify-center text-center space-y-2.5">
        {/* Line 1: Developer Dedication Sentence */}
        <p className="text-sm font-medium text-text-primary leading-relaxed">
          {tData.developerCredit}
        </p>

        {/* Line 2: Quran Source (Tanzil) + App Version separated by subtle dot */}
        <div className="flex items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-text-secondary flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span>{tData.quranSourcePre}</span>
            <a
              href="https://tanzil.net"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              <bdi>{tData.tanzilLinkText}</bdi>
              <ExternalLink className="w-3 h-3 text-primary" aria-hidden="true" />
            </a>
          </span>
          <span className="text-border select-none" aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1">
            <span>{tData.versionText}</span>
            <bdi dir="ltr">{APP_VERSION.startsWith('v') ? APP_VERSION : `v${APP_VERSION}`}</bdi>
          </span>
        </div>

        {/* Line 3: WhatsApp Contact Link & Formatted Number */}
        {hasWhatsApp && (
          <div className="pt-0.5 flex items-center justify-center gap-2.5 flex-wrap">
            {isOffline ? (
              <div
                className="h-10 min-h-[44px] sm:min-h-0 px-4 rounded-lg border border-border bg-surface text-text-secondary/70 inline-flex items-center justify-center gap-2 text-sm cursor-not-allowed select-none"
                title={tData.offlineNotice}
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" aria-hidden="true" />
                <span>{tData.whatsappContact}</span>
                <span className="text-[11px] opacity-75 inline-flex items-center gap-1 bg-background px-1.5 py-0.5 rounded border border-border">
                  <WifiOff className="w-3 h-3 text-text-secondary/70" />
                  {tData.offlineNotice}
                </span>
              </div>
            ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${tData.ariaWhatsapp}: ${formattedNumber}`}
                className="h-10 min-h-[44px] sm:min-h-0 px-4 rounded-lg border border-border bg-surface hover:bg-background hover:border-primary/40 text-text-primary text-sm font-medium inline-flex items-center justify-center gap-2 transition duration-150 shadow-2xs hover:shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" aria-hidden="true" />
                <span>{tData.whatsappContact}</span>
              </a>
            )}
            <span className="text-xs text-text-secondary">
              <bdi dir="ltr">{formattedNumber}</bdi>
            </span>
          </div>
        )}
      </div>
    </footer>
  );
};
