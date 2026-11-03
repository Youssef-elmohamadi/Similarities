import React, { useState, useEffect } from 'react';
import { Download, Loader2, Palette, Type, AlertTriangle, WifiOff, FileText, Check, Printer } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { exportCollectionToPdf } from '@/lib/collectionPdfGenerator';
import { CollectionDetail } from '@/types/collection';

export interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionTitle: string;
  collection?: CollectionDetail;
  hasUnsavedChanges?: boolean;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionTitle,
  collection,
  hasUnsavedChanges = false,
}) => {
  const { t } = useLanguage();

  // Load preferences from localStorage (defaults: color=true, fontSize='normal')
  const [color, setColor] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdf_export_color');
    return saved !== null ? saved === 'true' : true;
  });

  const [fontSize, setFontSize] = useState<'normal' | 'large'>(() => {
    const saved = localStorage.getItem('pdf_export_font_size');
    return saved === 'large' ? 'large' : 'normal';
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [ignoreUnsaved, setIgnoreUnsaved] = useState(false);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save preferences to localStorage
  const handleColorChange = (newColor: boolean) => {
    setColor(newColor);
    localStorage.setItem('pdf_export_color', String(newColor));
  };

  const handleFontSizeChange = (newSize: 'normal' | 'large') => {
    setFontSize(newSize);
    localStorage.setItem('pdf_export_font_size', newSize);
  };

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);

    try {
      let targetCollection = collection;
      if (!targetCollection) {
        if (!isOnline) {
          throw new Error('OFFLINE_FETCH_REQUIRED');
        }
        const response = await api.get<CollectionDetail>(`/collections/${collectionId}`);
        targetCollection = response.data;
      }

      exportCollectionToPdf(targetCollection, {
        color,
        fontSize,
      });

      // Close modal upon successful export initiation
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      if (err.message === 'OFFLINE_FETCH_REQUIRED') {
        setExportError(
          t(
            'يتطلب جلب بيانات المجموعة اتصالاً بالإنترنت لأول مرة.',
            'Internet connection required to load collection data.'
          )
        );
      } else if (err.response?.status === 404) {
        setExportError(t('المجموعة غير موجودة أو تم حذفها.', 'Collection not found or deleted.'));
      } else {
        setExportError(
          t(
            'حدث خطأ أثناء إعداد وتصدير ملف PDF. يرجى المحاولة مرة أخرى.',
            'An error occurred while preparing the PDF export. Please try again.'
          )
        );
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('تصدير المجموعة إلى ملف PDF', 'Export Collection to PDF')}
      maxWidth="md"
    >
      <div className="space-y-5 text-start">
        {/* Offline Warning Banner (only if collection is not already in memory) */}
        {!isOnline && !collection && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t('أنت غير متصل بالإنترنت حالياً', 'You are currently offline')}</p>
              <p className="mt-0.5 text-text-secondary">
                {t(
                  'يتطلب جلب بيانات هذه المجموعة اتصالاً بالإنترنت لأول مرة.',
                  'Loading collection data requires an internet connection for the first time.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Unsaved Changes Warning Banner */}
        {hasUnsavedChanges && !ignoreUnsaved && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t('تنبيه: توجد تعديلات قيد المزامنة', 'Warning: Changes pending sync')}</p>
                <p className="mt-0.5 text-text-secondary">
                  {t(
                    'يتم إنشاء ملف PDF بناءً على البيانات المحفوظة في السحابة. يُفضل حفظ التعديلات أولاً.',
                    'The PDF is generated using cloud-saved data. It is recommended to let changes finish syncing first.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIgnoreUnsaved(true)}
              className="text-xs font-semibold text-primary underline block ms-6"
            >
              {t('متابعة التصدير على أي حال', 'Proceed with export anyway')}
            </button>
          </div>
        )}

        {/* Export Error Alert */}
        {exportError && (
          <div className="p-3 rounded-lg bg-danger-subtle border border-danger/20 text-xs text-danger space-y-2">
            <p className="font-semibold">{exportError}</p>
            <Button size="sm" variant="outline" onClick={handleExport} className="h-7 text-xs">
              {t('إعادة المحاولة', 'Retry')}
            </Button>
          </div>
        )}

        {/* Option 1: Color Mode */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" />
            <span>{t('نمط الألوان', 'Color Mode')}</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleColorChange(true)}
              className={`p-3 rounded-xl border text-start transition flex items-start gap-2.5 ${
                color
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {color && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-text-primary block">{t('ملون (الافتراضي)', 'Color (Default)')}</span>
                <span className="text-[11px] text-text-secondary block leading-snug">
                  {t('ألوان متناسقة مع إبراز الفوارق باللون الزمردي والذهبي', 'Emerald and gold highlights')}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleColorChange(false)}
              className={`p-3 rounded-xl border text-start transition flex items-start gap-2.5 ${
                !color
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {!color && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-text-primary block">{t('أبيض وأسود', 'Black & White')}</span>
                <span className="text-[11px] text-text-secondary block leading-snug">
                  {t('مناسب للطباعة الورقية مع إبراز الفوارق بالتسطير والتأطير', 'High contrast for paper printing')}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Option 2: Verse Font Size */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5" />
            <span>{t('حجم خط الآيات القرآنية', 'Verse Font Size')}</span>
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleFontSizeChange('normal')}
              className={`p-3 rounded-xl border text-start transition flex items-start gap-2.5 ${
                fontSize === 'normal'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {fontSize === 'normal' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-text-primary block">{t('عادي (١٨ نقطة)', 'Normal (18pt)')}</span>
                <span className="text-[11px] text-text-secondary block leading-snug">
                  {t('حجم متوازن واقتصادي في عدد الصفحات', 'Standard balanced compact layout')}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleFontSizeChange('large')}
              className={`p-3 rounded-xl border text-start transition flex items-start gap-2.5 ${
                fontSize === 'large'
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <div className="w-4 h-4 rounded-full border border-primary flex items-center justify-center shrink-0 mt-0.5">
                {fontSize === 'large' && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-text-primary block">{t('كبير (٢٢ نقطة)', 'Large (22pt)')}</span>
                <span className="text-[11px] text-text-secondary block leading-snug">
                  {t('خط عريض ومريح جداً للقراءة والمطالعة', 'Large font for relaxed reading')}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Features Info Box */}
        <div className="p-3 rounded-lg bg-surface border border-border text-[11px] text-text-secondary space-y-1">
          <div className="font-semibold text-text-primary flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span>{t('محتويات الملف المصدر:', 'Included in Export:')}</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 ps-1">
            <li>{t('الرسم العثماني المعتمد برواية حفص عن عاصم (مشروع تنزيل)', 'Verified Tanzil Uthmani script')}</li>
            <li>{t('مواضع المتشابهات مع الفوارق الدقيقة وتوجيهها', 'Similarities, differences, and explanations')}</li>
            <li>{t('الروابط والتقنيات الحفظية والملاحظات الخاصة', 'Memorization aids and personal notes')}</li>
            <li>{t('ترقيم تلقائي للصفحات مع الحفاظ على ترابط كتل الآيات', 'Page numbers with clean non-breaking blocks')}</li>
          </ul>
        </div>

        {/* Screen Reader Live Status */}
        <div aria-live="polite" className="sr-only">
          {isExporting ? t('جارٍ تجهيز ملف PDF...', 'Preparing PDF file...') : ''}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
          <Button variant="ghost" size="md" onClick={onClose} disabled={isExporting}>
            {t('إلغاء', 'Cancel')}
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            onClick={handleExport}
            disabled={(!isOnline && !collection) || isExporting}
            title={!isOnline && !collection ? t('يتطلب اتصالاً بالإنترنت لتحميل البيانات', 'Requires internet connection to load data') : undefined}
          >
            {isExporting ? t('جارٍ تجهيز الملف...', 'Preparing PDF...') : t('تصدير / حفظ كـ PDF', 'Export / Save as PDF')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

