import React, { useState, useEffect } from 'react';
import { Download, Loader2, Palette, Type, AlertTriangle, WifiOff, FileText, Check, Printer, Layers } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/api';
import { exportCollectionToPdf } from '@/lib/collectionPdfGenerator';
import { CollectionDetail } from '@/types/collection';
import { toArabicDigits } from '@/lib/utils';
import { useNetworkStatus } from '@/offline/connectivity';
import { getCachedCollectionDetail } from '@/offline/userDataDb';

export interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  collectionTitle: string;
  collection?: CollectionDetail;
  initialSelectedComparisonId?: string;
  hasUnsavedChanges?: boolean;
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  collectionId,
  collectionTitle,
  collection,
  initialSelectedComparisonId,
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

  const comparisons = collection?.comparisons || [];
  const [selectedCompIds, setSelectedCompIds] = useState<Set<string>>(() => {
    if (initialSelectedComparisonId) {
      return new Set([initialSelectedComparisonId]);
    }
    return new Set(comparisons.map(c => c.id));
  });

  // Re-sync when modal opens or initial selection changes
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedComparisonId) {
        setSelectedCompIds(new Set([initialSelectedComparisonId]));
      } else {
        setSelectedCompIds(new Set(comparisons.map(c => c.id)));
      }
    }
  }, [isOpen, initialSelectedComparisonId, collection]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const isOnline = useNetworkStatus();
  const [ignoreUnsaved, setIgnoreUnsaved] = useState(false);

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

    if (comparisons.length > 0 && selectedCompIds.size === 0) {
      setExportError(t('يرجى اختيار موضع واحد على الأقل لتصديره.', 'Please select at least one position to export.'));
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      let targetCollection = collection;
      if (!targetCollection) {
        try {
          const userStr = localStorage.getItem('user');
          const userId = userStr ? JSON.parse(userStr)?.id : undefined;
          if (userId) {
            const cached = await getCachedCollectionDetail(userId, collectionId);
            if (cached) {
              targetCollection = cached as unknown as CollectionDetail;
            }
          }
        } catch {
          // ignore
        }
      }
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
        selectedComparisonIds: comparisons.length > 0 ? Array.from(selectedCompIds) : undefined,
      });

      // Close modal upon initiating export
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

        {/* Option: Choose Sub-Collections (When comparisons exist) */}
        {comparisons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>{t('اختر المواضع المراد تصديرها', 'Select Sub-Collections to Export')}</span>
                <span className="text-[11px] font-normal text-text-secondary">
                  ({toArabicDigits(selectedCompIds.size)} / {toArabicDigits(comparisons.length)})
                </span>
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCompIds(new Set(comparisons.map(c => c.id)))}
                  className="text-primary hover:underline font-semibold"
                >
                  {t('تحديد الكل', 'Select All')}
                </button>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedCompIds(new Set())}
                  className="text-text-secondary hover:text-danger font-semibold"
                >
                  {t('إلغاء التحديد', 'Deselect All')}
                </button>
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-border bg-surface/50">
              {comparisons.map((cmp, idx) => {
                const isChecked = selectedCompIds.has(cmp.id);
                const vCount = cmp.verses?.length || 0;
                return (
                  <label
                    key={cmp.id}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition ${
                      isChecked
                        ? 'border-primary/50 bg-primary/5 font-semibold text-text-primary'
                        : 'border-transparent text-text-secondary hover:bg-charcoal-100/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          const next = new Set(selectedCompIds);
                          if (e.target.checked) next.add(cmp.id);
                          else next.delete(cmp.id);
                          setSelectedCompIds(next);
                        }}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4 shrink-0"
                      />
                      <span className="truncate">
                        <span className="text-text-secondary me-1">{toArabicDigits(idx + 1)}.</span>
                        <bdi dir="auto">{cmp.title}</bdi>
                      </span>
                    </div>
                    <span className="text-[11px] text-text-secondary px-1.5 py-0.5 rounded bg-charcoal-100 shrink-0 ms-2">
                      {toArabicDigits(vCount)} {vCount === 1 ? t('آية', 'ayah') : t('آيات', 'ayahs')}
                    </span>
                  </label>
                );
              })}
            </div>
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
            <span>{t('محتويات وتنسيق التصدير المخصص:', 'Included in Custom Export:')}</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 ps-1">
            <li>{t('فهرس مواضع منظم (عند تصدير موضعين أو أكثر)', 'Structured Table of Contents')}</li>
            <li>{t('فصل كل موضع فرعي في قسم مستقل يبدأ بصفحة جديدة', 'Each sub-collection starts on a new page')}</li>
            <li>{t('الرسم العثماني المعتمد برواية حفص عن عاصم (مشروع تنزيل)', 'Verified Tanzil Uthmani script')}</li>
            <li>{t('مواضع المتشابهات مع الفوارق الدقيقة وتوجيهها والملاحظات', 'Similarities, differences, and explanations')}</li>
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
            disabled={(!isOnline && !collection) || (comparisons.length > 0 && selectedCompIds.size === 0) || isExporting}
            title={
              !isOnline && !collection
                ? t('يتطلب اتصالاً بالإنترنت لتحميل البيانات', 'Requires internet connection to load data')
                : comparisons.length > 0 && selectedCompIds.size === 0
                ? t('يرجى تحديد موضع واحد على الأقل', 'Please select at least one position')
                : undefined
            }
          >
            {isExporting ? t('جارٍ تجهيز الملف...', 'Preparing PDF...') : t('تصدير / حفظ كـ PDF', 'Export / Save as PDF')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
