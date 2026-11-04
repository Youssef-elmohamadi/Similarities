import React from 'react';
import { Modal } from '@/components/common/Modal';
import { QuranVerse } from '@/types/quran';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard, toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';

export interface VersePreviewModalProps {
  verse: QuranVerse | null;
  onClose: () => void;
}

export const VersePreviewModal: React.FC<VersePreviewModalProps> = ({ verse, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();
  const { t } = useLanguage();

  if (!verse) return null;

  const handleCopy = async () => {
    const formatted = `﴿${verse.uthmaniText}﴾ [${verse.surahNameArabic}: ${verse.ayahNumber}]`;
    const success = await copyToClipboard(formatted);
    if (success) {
      setCopied(true);
      toast.success(t('تم نسخ الآية الكريمة', 'Verse copied to clipboard'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={!!verse}
      onClose={onClose}
      title={`${t('سورة', 'Surah')} ${verse.surahNameArabic} - ${t('الآية', 'Ayah')} ${toArabicDigits(verse.ayahNumber)}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="primary">{t('سورة', 'Surah')} {verse.surahNameArabic}</Badge>
          <Badge variant="charcoal">{t('الآية رقم', 'Ayah No.')} {toArabicDigits(verse.ayahNumber)}</Badge>
          <Badge variant="outline">{verse.surahNameEnglish}</Badge>
        </div>

        <div className="p-6 md:p-8 bg-background border border-border rounded-xl text-center space-y-4">
          {/* Decorative Bismillah header for Ayah 1 of any surah except 1 and 9 */}
          {verse.ayahNumber === 1 && verse.surahId !== 1 && verse.surahId !== 9 && (
            <div className="pb-3 border-b border-border/50 select-none" aria-hidden="true">
              <span className="font-quran text-xl md:text-2xl text-primary/80 inline-block tracking-wide">
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </span>
            </div>
          )}

          <p
            dir="rtl"
            lang="ar"
            className="font-quran py-2 selection:bg-accent-tint"
          >
            {verse.uthmaniText}{' '}
            <span className="ayah-number-badge text-primary font-bold">
              {formatAyahOrnament(verse.ayahNumber)}
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            icon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            onClick={handleCopy}
          >
            {copied ? t('تم النسخ', 'Copied') : t('نسخ الآية', 'Copy Verse')}
          </Button>

          <Button size="sm" variant="secondary" onClick={onClose}>
            {t('إغلاق', 'Close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
