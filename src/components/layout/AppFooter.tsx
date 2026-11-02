import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { landingTranslations } from '@/i18n/landingTranslations';
import { WHATSAPP_NUMBER, APP_VERSION, getWhatsAppUrl, formatWhatsAppDisplay } from '@/config/appConfig';
import { ExternalLink, MessageCircle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppFooterProps {
  className?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ className }) => {
  const { language } = useLanguage();
  const tData = landingTranslations[language].footer;

  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasWhatsApp = Boolean(WHATSAPP_NUMBER && WHATSAPP_NUMBER.length > 0);
  const whatsappUrl = hasWhatsApp ? getWhatsAppUrl(tData.whatsappPrefilledMessage) : '';
  const formattedNumber = formatWhatsAppDisplay(WHATSAPP_NUMBER);

  return (
    <footer
      role="contentinfo"
      className={cn(
        'w-full border-t border-border/80 bg-surface/50 text-text-secondary text-sm py-6 px-4 transition-colors',
        className
      )}
    >
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center text-center space-y-3">
        {/* Line 1: Developer Dua Credit */}
        <p className="text-text-primary text-sm sm:text-base font-medium leading-relaxed">
          {tData.developerCredit}
        </p>

        {/* Line 2: Quran Source & Tanzil Attribution */}
        <p className="text-xs text-text-secondary flex items-center justify-center gap-1.5 flex-wrap">
          <span>{tData.quranSourcePre}</span>
          <a
            href="https://tanzil.net"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
          >
            <bdi>{tData.tanzilLinkText}</bdi>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </p>

        {/* Line 3: WhatsApp Contact Link & Number (if configured) */}
        {hasWhatsApp && (
          <div className="pt-1 flex flex-col items-center gap-1.5">
            {isOffline ? (
              <div
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-border bg-surface text-text-secondary/70 inline-flex items-center justify-center gap-2 text-xs cursor-not-allowed select-none shadow-2xs"
                title={tData.offlineNotice}
              >
                <MessageCircle className="w-4 h-4 text-text-secondary/50" aria-hidden="true" />
                <span className="font-medium">{tData.whatsappContact}</span>
                <span className="text-[11px] opacity-75 inline-flex items-center gap-1 bg-background px-2 py-0.5 rounded-full border border-border">
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
                style={{ backgroundColor: '#25D366', color: '#ffffff' }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl !bg-[#25D366] hover:!bg-[#20BD5A] !text-white font-medium text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition duration-150 shadow-sm hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]"
              >
                {/* Clean WhatsApp SVG icon in crisp white */}
                <svg
                  className="w-4 h-4 fill-white shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-1.995-.466-.999-.414-1.637-1.428-1.687-1.494-.049-.066-.401-.533-.401-1.017 0-.484.254-.722.345-.821.09-.098.197-.123.262-.123.065 0 .131.001.189.004.06.003.14-.023.218.164.082.197.279.68.303.73.025.049.041.107.008.172-.033.066-.049.107-.098.164-.049.057-.104.127-.148.171-.049.049-.1.102-.043.2.057.098.256.422.548.682.377.336.695.441.793.49.099.049.156.041.214-.025.057-.066.246-.287.311-.385.066-.098.131-.082.222-.049.09.033.574.271.672.32.099.049.164.074.189.115.025.041.025.238-.119.643zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.66 1.434 5.176L2 22l4.954-1.399C8.423 21.493 10.153 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.05c-1.642 0-3.167-.487-4.449-1.325l-.319-.209-2.943.832.842-2.871-.225-.327C3.996 14.839 3.45 13.468 3.45 12c0-4.714 3.836-8.55 8.55-8.55 4.714 0 8.55 3.836 8.55 8.55 0 4.714-3.836 8.55-8.55 8.55z" />
                </svg>
                <span className="text-white font-medium">{tData.whatsappContact}</span>
                <span className="opacity-70 text-white">|</span>
                <bdi dir="ltr" className="font-mono text-xs sm:text-sm font-semibold text-white">
                  {formattedNumber}
                </bdi>
              </a>
            )}
          </div>
        )}

        {/* Line 4: App Version */}
        <p className="text-[11px] text-text-secondary/70 tracking-wider">
          <span>{tData.versionText}</span> <bdi dir="ltr">{APP_VERSION}</bdi>
        </p>
      </div>
    </footer>
  );
};

