import React, { useState } from 'react';
import { VerseComparison, VerseDifference } from '@/types/comparison';
import { CollectionVerse } from '@/types/collection';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Card } from '@/components/common/Card';
import { GitCompare, Plus, Trash2, Edit2, Sparkles, AlertCircle } from 'lucide-react';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface ComparisonEditorProps {
  collectionId: string;
  baseSurahId?: number;
  baseSurahNameArabic?: string;
  verses: CollectionVerse[];
  comparisons: VerseComparison[];
  onCreateComparison: (payload: {
    title: string;
    description?: string;
    sharedPhrases?: string;
    quranVerseIds: number[];
    anchorQuranVerseId?: number;
  }) => Promise<void>;
  onDeleteComparison: (comparisonId: string) => Promise<void>;
  onAddDifference: (comparisonId: string, payload: { quranVerseId: number; selectedText: string; explanation: string }) => Promise<void>;
  onDeleteDifference: (differenceId: string) => Promise<void>;
}

export const ComparisonEditor: React.FC<ComparisonEditorProps> = ({
  baseSurahId,
  baseSurahNameArabic,
  verses,
  comparisons,
  onCreateComparison,
  onDeleteComparison,
  onAddDifference,
  onDeleteDifference,
}) => {
  const { t, direction } = useLanguage();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [activeComparisonId, setActiveComparisonId] = useState<string | null>(null);

  // New comparison form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sharedPhrases, setSharedPhrases] = useState('');
  const [selectedVerseIds, setSelectedVerseIds] = useState<number[]>([]);
  const [anchorVerseId, setAnchorVerseId] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New difference form state
  const [diffVerseId, setDiffVerseId] = useState<number>(verses[0]?.quranVerseId || 0);
  const [selectedText, setSelectedText] = useState('');
  const [explanation, setExplanation] = useState('');

  const isRtl = direction === 'rtl';

  const handleOpenCreateModal = () => {
    setTitle('');
    setDescription('');
    setSharedPhrases('');
    const allIds = verses.map(v => v.quranVerseId);
    setSelectedVerseIds(allIds);
    const baseVerse = baseSurahNameArabic
      ? verses.find(v => v.surahNameArabic === baseSurahNameArabic)
      : verses[0];
    setAnchorVerseId(baseVerse?.quranVerseId);
    setIsCreateModalOpen(true);
  };

  const handleSaveComparison = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedVerseIds.length === 0) return;

    setIsSubmitting(true);
    try {
      await onCreateComparison({
        title: title.trim(),
        description: description.trim() || undefined,
        sharedPhrases: sharedPhrases.trim() || undefined,
        quranVerseIds: selectedVerseIds,
        anchorQuranVerseId: anchorVerseId,
      });
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDiffModal = (comparisonId: string) => {
    setActiveComparisonId(comparisonId);
    setDiffVerseId(verses[0]?.quranVerseId || 0);
    setSelectedText('');
    setExplanation('');
    setIsDiffModalOpen(true);
  };

  const handleSaveDifference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComparisonId || !diffVerseId || !selectedText.trim() || !explanation.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddDifference(activeComparisonId, {
        quranVerseId: diffVerseId,
        selectedText: selectedText.trim(),
        explanation: explanation.trim(),
      });
      setIsDiffModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleVerseSelection = (id: number) => {
    setSelectedVerseIds(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 text-start">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-primary-tint/40 border border-primary/20">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-primary flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <span>{t('مقارنة المتشابهات ورصد الفروق', 'Similarities & Differences Comparison')}</span>
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            {t(
              'أنشئ مقارنات مخصصة بين الآيات لتوثيق الألفاظ المشتركة ورصد مواضع الاختلاف وربطها بوضوح.',
              'Create custom comparisons to document shared phrases and isolate distinct phrasing differences.'
            )}
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreateModal}
          className="shrink-0"
        >
          {t('إضافة مقارنة جديدة', 'New Comparison')}
        </Button>
      </div>

      {/* Comparisons List */}
      {comparisons.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-surface">
          <GitCompare className="w-10 h-10 text-text-secondary/40 mx-auto mb-3" />
          <h4 className="font-semibold text-base text-text-primary mb-1">
            {t('لا توجد مقارنات بعد في هذه المجموعة', 'No comparisons documented yet')}
          </h4>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-5 leading-relaxed">
            {t(
              'يمكنك إنشاء مقارنة بين آيتين أو أكثر لتوثيق الكلمات المشتركة والفوارق الدقيقة بينها.',
              'You can compare two or more verses to note shared phrases and exact differences.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={handleOpenCreateModal}>
            {t('إنشاء أول مقارنة', 'Create First Comparison')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {comparisons.map(comparison => (
            <Card key={comparison.id} className="p-5 md:p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <h4 className="font-semibold text-lg text-text-primary flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0" />
                    <span>{comparison.title}</span>
                  </h4>
                  {comparison.description && (
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {comparison.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => handleOpenDiffModal(comparison.id)}
                  >
                    {t('رصد فارق لفظي', 'Add Difference')}
                  </Button>

                  <button
                    onClick={() => onDeleteComparison(comparison.id)}
                    className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                    title={t('حذف المقارنة', 'Delete Comparison')}
                    aria-label={t('حذف المقارنة', 'Delete Comparison')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Shared Phrases Callout */}
              {comparison.sharedPhrases && (
                <div className="p-4 rounded-xl bg-accent-tint/60 border border-accent/25">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-1">
                    {t('الألفاظ والعبارات المشتركة بين الآيات:', 'Shared Phrases Across Verses:')}
                  </span>
                  <p className="text-base font-semibold text-text-primary">
                    {comparison.sharedPhrases}
                  </p>
                </div>
              )}

              {/* Compared Verses */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  {t('الآيات محل المقارنة:', 'Compared Verses:')}
                </span>

                <div className="grid grid-cols-1 gap-3">
                  {comparison.verses.map(compVerse => {
                    const isAnchor = comparison.anchorQuranVerseId
                      ? compVerse.quranVerseId === comparison.anchorQuranVerseId
                      : (baseSurahNameArabic && compVerse.surahNameArabic === baseSurahNameArabic);

                    return (
                      <div
                        key={compVerse.id}
                        className={`p-4 md:p-5 rounded-xl transition ${
                          isAnchor
                            ? 'bg-amber-500/10 dark:bg-amber-950/25 border-2 border-amber-500/40 shadow-xs'
                            : 'bg-background border border-border'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {isAnchor ? (
                            <Badge variant="gold" size="sm">
                              <Sparkles className="w-3.5 h-3.5 me-1 inline-block" />
                              {t('موضع السورة الأساس (المرجع)', 'Anchor Verse')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" size="sm">
                              {t('موضع مقارن', 'Compared Verse')}
                            </Badge>
                          )}
                          <Badge variant="primary" size="sm">
                            {t('سورة', 'Surah')} {compVerse.surahNameArabic}
                          </Badge>
                          <Badge variant="charcoal" size="sm">
                            {t('الآية', 'Ayah')} {toArabicDigits(compVerse.ayahNumber)}
                          </Badge>
                        </div>
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-quran text-lg md:text-xl text-text-primary text-start leading-[2.5] py-1"
                        >
                          {compVerse.uthmaniText}{' '}
                          <span className="ayah-number-badge text-primary font-bold">
                            {formatAyahOrnament(compVerse.ayahNumber)}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Documented Differences List */}
              <div className="pt-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-3">
                  {t('الفوارق المرصودة ومواضع الاختلاف:', 'Documented Differences:')}
                </span>

                {comparison.differences.length === 0 ? (
                  <p className="text-xs text-text-secondary italic">
                    {t('لم يتم رصد فوارق فردية بعد لهذه المقارنة.', 'No specific differences added yet.')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {comparison.differences.map(diff => (
                      <div
                        key={diff.id}
                        className="p-4 rounded-xl bg-surface border border-border flex items-start justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-1.5 text-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="accent" size="sm">
                              {t('سورة', 'Surah')} {diff.surahNameArabic} : {t('الآية', 'Ayah')} {toArabicDigits(diff.ayahNumber)}
                            </Badge>
                            <span className="text-xs font-bold text-primary bg-primary-tint px-2.5 py-1 rounded-md border border-primary/20">
                              « {diff.selectedText} »
                            </span>
                          </div>
                          <p className="text-sm text-text-primary leading-relaxed ps-1">
                            {diff.explanation}
                          </p>
                        </div>

                        <button
                          onClick={() => onDeleteDifference(diff.id)}
                          className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition shrink-0"
                          title={t('حذف هذا الفارق', 'Delete Difference')}
                          aria-label={t('حذف هذا الفارق', 'Delete Difference')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Create Comparison */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('إضافة مقارنة جديدة بين الآيات', 'Create New Comparison')}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveComparison} className="space-y-4">
          <Input
            label={t('عنوان المقارنة *', 'Comparison Title *')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('مثال: مقارنة مواضع (إِنَّ اللَّهَ غَفُورٌ رَحِيمٌ)', 'e.g. Comparison of phrase variants')}
            required
            autoFocus
          />

          <Input
            label={t('الألفاظ والعبارات المشتركة (اختياري)', 'Shared Phrases (Optional)')}
            value={sharedPhrases}
            onChange={e => setSharedPhrases(e.target.value)}
            placeholder={t('اكتب العبارة أو الكلمات المشتركة بين الآيات', 'Shared wording across verses')}
          />

          <Textarea
            label={t('وصف أو ملخص المقارنة (اختياري)', 'Comparison Description (Optional)')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('اكتب ملخصاً حول سبب المقارنة والهدف منها...', 'Summary of this comparison...')}
            rows={2}
          />

          {/* Verses Selection Checkboxes */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {t('اختر الآيات التي تشملها المقارنة *', 'Select Verses for Comparison *')}
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto p-1 border border-border rounded-lg bg-background">
              {verses.map(v => (
                <label
                  key={v.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 hover:bg-surface cursor-pointer text-xs transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedVerseIds.includes(v.quranVerseId)}
                    onChange={() => toggleVerseSelection(v.quranVerseId)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary border-border"
                  />
                  <div className="flex-1 truncate text-start">
                    <span className="font-bold text-text-primary">
                      [{v.surahNameArabic}: {toArabicDigits(v.ayahNumber)}]
                    </span>{' '}
                    <span className="font-quran text-text-secondary">{v.uthmaniText}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Anchor Verse Selection */}
          {selectedVerseIds.length > 0 && (
            <div className="p-3.5 rounded-lg bg-primary-tint/20 border border-primary/25 space-y-2">
              <label className="block text-xs sm:text-sm font-semibold text-text-primary">
                {t('الآية المرجع الأساسية للمقارنة (الموضع الأصل) *', 'Anchor Verse (Base Context) *')}
              </label>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                {baseSurahNameArabic
                  ? t(`في هذه المجموعة، يفضل اختيار موضع سورة ${baseSurahNameArabic} كمرجع تقاس عليه الفروق في السور الأخرى.`, `In this collection, choose a verse from Surah ${baseSurahNameArabic} as the base.`)
                  : t('الآية التي يُقاس عليها التغيير أو الفارق اللفظي في باقي الآيات.', 'The verse against which other verses will be compared.')}
              </p>
              <Select
                value={anchorVerseId || ''}
                onChange={e => setAnchorVerseId(e.target.value ? Number(e.target.value) : undefined)}
                options={verses
                  .filter(v => selectedVerseIds.includes(v.quranVerseId))
                  .map(v => {
                    const isBase = baseSurahNameArabic && v.surahNameArabic === baseSurahNameArabic;
                    return {
                      value: v.quranVerseId,
                      label: `${isBase ? '⭐ [سورة الأساس] ' : ''}سورة ${v.surahNameArabic} - الآية ${toArabicDigits(v.ayahNumber)}: ${v.uthmaniText.slice(0, 35)}...`,
                    };
                  })}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!title.trim() || selectedVerseIds.length === 0}
            >
              {t('حفظ المقارنة', 'Save Comparison')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Difference */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title={t('رصد فارق في موضع محدد', 'Document a Wording Difference')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDifference} className="space-y-4">
          <Select
            label={t('الآية التي تحتوي الفارق *', 'Verse with Difference *')}
            value={diffVerseId}
            onChange={e => setDiffVerseId(Number(e.target.value))}
            options={verses.map(v => ({
              value: v.quranVerseId,
              label: `${t('سورة', 'Surah')} ${v.surahNameArabic} - ${t('الآية', 'Ayah')} ${toArabicDigits(v.ayahNumber)}`,
            }))}
          />

          <Input
            label={t('اللفظ أو النص المميز في هذا الموضع *', 'Selected Distinct Phrasing *')}
            value={selectedText}
            onChange={e => setSelectedText(e.target.value)}
            placeholder={t('مثال: بِالْبَيِّنَاتِ، وَلَكِنَّ أَكْثَرَهُمْ', 'e.g. distinct word or phrase')}
            required
            autoFocus
          />

          <Textarea
            label={t('شرح الفارق وملاحظات التمييز *', 'Explanation of Difference *')}
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder={t('بيّن وجه التمييز بين هذا الموضع والمواضع الأخرى لترسيخ الحفظ...', 'Explain how to remember this distinction...')}
            rows={3}
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDiffModalOpen(false)}
            >
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!selectedText.trim() || !explanation.trim()}
            >
              {t('إضافة الفارق', 'Add Difference')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
