import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VerseComparison, VerseDifference } from '@/types/comparison';
import { CollectionVerse } from '@/types/collection';
import { QuranVerse } from '@/types/quran';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { Card } from '@/components/common/Card';
import { GitCompare, Plus, Trash2, Edit2, Sparkles, AlertCircle, Search, Check, X, Layers, BookOpen } from 'lucide-react';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { getVersesBySurahId, isOfflineDatasetAvailable, CompactVerse } from '@/offline/quranDb';
import { searchLocalWorker } from '@/offline/searchWorkerClient';
import { api } from '@/lib/api';

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
  const [anchorVerseId, setAnchorVerseId] = useState<number | undefined>(undefined);
  const [selectedOtherVerses, setSelectedOtherVerses] = useState<Array<{ id: number; surahNameArabic: string; ayahNumber: number; uthmaniText: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal verse search state
  const [searchQuery, setSearchQuery] = useState('');

  // New difference form state
  const [diffVerseId, setDiffVerseId] = useState<number>(verses[0]?.quranVerseId || 0);
  const [selectedText, setSelectedText] = useState('');
  const [explanation, setExplanation] = useState('');

  const isRtl = direction === 'rtl';

  // Load verses of the base surah for quick selection
  const { data: baseSurahVerses = [] } = useQuery<CompactVerse[]>({
    queryKey: ['baseSurahVerses', baseSurahId],
    networkMode: 'always',
    queryFn: async () => {
      if (!baseSurahId) return [];
      try {
        const local = await getVersesBySurahId(baseSurahId);
        if (local && local.length > 0) return local;
      } catch (e) {
        console.warn('Failed to load base surah verses', e);
      }
      return [];
    },
    enabled: !!baseSurahId,
  });

  // Modal verse search query
  const { data: searchResults = [], isFetching: isSearching } = useQuery<QuranVerse[]>({
    queryKey: ['clusterSearchVerses', searchQuery],
    networkMode: 'always',
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
      const hasLocal = await isOfflineDatasetAvailable();
      if (hasLocal) {
        try {
          const localRes = await searchLocalWorker({ q: searchQuery.trim(), pageSize: 10 });
          return localRes.items;
        } catch (e) {
          console.warn('Local search failed', e);
        }
      }
      if (!navigator.onLine) {
        const localRes = await searchLocalWorker({ q: searchQuery.trim(), pageSize: 10 });
        return localRes.items;
      }
      try {
        const res = await api.get<{ items: QuranVerse[] }>(`/quran/search?q=${encodeURIComponent(searchQuery.trim())}&pageSize=10`);
        return res.data.items;
      } catch {
        const localRes = await searchLocalWorker({ q: searchQuery.trim(), pageSize: 10 });
        return localRes.items;
      }
    },
    enabled: isCreateModalOpen && searchQuery.trim().length > 1,
  });

  const handleOpenCreateModal = () => {
    setTitle('');
    setDescription('');
    setSharedPhrases('');
    setSearchQuery('');

    // Pre-select base verse
    if (baseSurahVerses.length > 0) {
      setAnchorVerseId(baseSurahVerses[0].id);
    } else if (verses.length > 0) {
      const baseV = baseSurahNameArabic
        ? verses.find(v => v.surahNameArabic === baseSurahNameArabic)
        : verses[0];
      setAnchorVerseId(baseV?.quranVerseId);
    } else {
      setAnchorVerseId(undefined);
    }

    // Default other verses from existing collection verses (excluding anchor)
    const existingOther = verses
      .filter(v => (baseSurahNameArabic ? v.surahNameArabic !== baseSurahNameArabic : true))
      .map(v => ({
        id: v.quranVerseId,
        surahNameArabic: v.surahNameArabic,
        ayahNumber: v.ayahNumber,
        uthmaniText: v.uthmaniText,
      }));
    setSelectedOtherVerses(existingOther);

    setIsCreateModalOpen(true);
  };

  const handleAddComparativeVerse = (v: QuranVerse) => {
    if (v.id === anchorVerseId) return;
    if (selectedOtherVerses.some(item => item.id === v.id)) return;
    setSelectedOtherVerses(prev => [
      ...prev,
      {
        id: v.id,
        surahNameArabic: v.surahNameArabic,
        ayahNumber: v.ayahNumber,
        uthmaniText: v.uthmaniText,
      },
    ]);
  };

  const handleRemoveComparativeVerse = (verseId: number) => {
    setSelectedOtherVerses(prev => prev.filter(item => item.id !== verseId));
  };

  const handleSaveComparison = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchorVerseId) return;

    const allVerseIds = [anchorVerseId, ...selectedOtherVerses.map(v => v.id)];
    const distinctIds = Array.from(new Set(allVerseIds));
    if (distinctIds.length === 0) return;

    let finalTitle = title.trim();
    if (!finalTitle) {
      if (baseSurahNameArabic) {
        const anchorAyahNum = baseSurahVerses.find(v => v.id === anchorVerseId)?.ayahNumber;
        finalTitle = anchorAyahNum
          ? `موضع الآية ${toArabicDigits(anchorAyahNum)} من سورة ${baseSurahNameArabic}`
          : `موضع متشابه في سورة ${baseSurahNameArabic}`;
      } else {
        finalTitle = `موضع متشابه`;
      }
    }

    setIsSubmitting(true);
    try {
      await onCreateComparison({
        title: finalTitle,
        description: description.trim() || undefined,
        sharedPhrases: sharedPhrases.trim() || undefined,
        quranVerseIds: distinctIds,
        anchorQuranVerseId: anchorVerseId,
      });
      setIsCreateModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDiffModal = (comparisonId: string) => {
    setActiveComparisonId(comparisonId);
    const comp = comparisons.find(c => c.id === comparisonId);
    setDiffVerseId(comp?.verses[0]?.quranVerseId || verses[0]?.quranVerseId || 0);
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

  // Sort comparisons by Anchor Verse Ayah Number (Mushaf Order)
  const sortedComparisons = [...comparisons].sort((a, b) => {
    const getAyah = (cmp: VerseComparison) => {
      if (cmp.anchorQuranVerseId) {
        const match = cmp.verses.find(v => v.quranVerseId === cmp.anchorQuranVerseId);
        if (match) return match.ayahNumber;
      }
      if (baseSurahNameArabic) {
        const match = cmp.verses.find(v => v.surahNameArabic === baseSurahNameArabic);
        if (match) return match.ayahNumber;
      }
      return cmp.verses[0]?.ayahNumber ?? 9999;
    };
    const ayahA = getAyah(a);
    const ayahB = getAyah(b);
    if (ayahA !== ayahB) return ayahA - ayahB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const activeAnchorPreview = baseSurahVerses.find(v => v.id === anchorVerseId);

  return (
    <div className="space-y-6 text-start">
      {/* Top Banner and Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary-tint/60 to-primary-tint/20 border border-primary/25 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base sm:text-lg text-primary flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>
                {baseSurahNameArabic
                  ? t(`مواضع متشابهات سورة ${baseSurahNameArabic}`, `Positions in Surah ${baseSurahNameArabic}`)
                  : t('مواضع المتشابهات والمقارنات', 'Similar Positions & Clusters')}
              </span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {isRtl ? toArabicDigits(comparisons.length) : comparisons.length} {t('مواضع', 'positions')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-2xl">
            {baseSurahNameArabic
              ? t(
                  `مرتبة بحسب تسلسل آيات سورة ${baseSurahNameArabic}؛ كل موضع يضم آية السورة الأصل مع نظائرها المقابلة والفروق الدقيقة الخاصة بها.`,
                  `Ordered by ayah sequence; each position groups the anchor verse with its parallels and distinctions.`
                )
              : t(
                  'كل موضع يجمع الآيات المتشابهة مع الفوارق الدقيقة ورصد أوجه التمييز.',
                  'Each position clusters similar verses with documented wording distinctions.'
                )}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleOpenCreateModal}
          className="shrink-0 shadow-sm"
        >
          {baseSurahNameArabic
            ? t(`+ إضافة موضع متشابه جديد في السورة`, `+ Add Position in Surah`)
            : t(`+ إضافة موضع متشابه جديد`, `+ Add Similar Position`)}
        </Button>
      </div>

      {/* Comparisons / Positions Clusters List */}
      {sortedComparisons.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border-2 border-dashed border-border bg-surface space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center mx-auto">
            <GitCompare className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="font-bold text-lg text-text-primary">
              {baseSurahNameArabic
                ? t(`لم تُضف أي مواضع متشابهة بعد في سورة ${baseSurahNameArabic}`, `No positions documented yet in Surah ${baseSurahNameArabic}`)
                : t('لا توجد مواضع متشابهة بعد في هذه المجموعة', 'No similarity positions documented yet')}
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              {baseSurahNameArabic
                ? t(
                    `ابدأ بإضافة أول موضع متشابه؛ حدد آية الأساس في سورة ${baseSurahNameArabic} ثم أضف الآيات المقابلة لها في السور الأخرى ورصد الفروق بينها.`,
                    `Start by adding the first position in Surah ${baseSurahNameArabic} and link comparative verses.`
                  )
                : t(
                    'يمكنك إنشاء موضع يجمع الآيات المتشابهة وتوثيق الكلمات المشتركة والفوارق الدقيقة بينها.',
                    'Create a position grouping similar verses to document nuances.'
                  )}
            </p>
          </div>
          <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />} onClick={handleOpenCreateModal}>
            {baseSurahNameArabic
              ? t(`إضافة أول موضع في سورة ${baseSurahNameArabic}`, `Add First Position`)
              : t('إضافة أول موضع متشابه', 'Create First Position')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedComparisons.map((comparison, idx) => {
            const anchorVerse = comparison.anchorQuranVerseId
              ? comparison.verses.find(v => v.quranVerseId === comparison.anchorQuranVerseId)
              : (baseSurahNameArabic
                  ? comparison.verses.find(v => v.surahNameArabic === baseSurahNameArabic)
                  : comparison.verses[0]);

            const otherVerses = comparison.verses.filter(v => v !== anchorVerse);

            return (
              <Card key={comparison.id} className="p-5 md:p-6 space-y-5 rounded-2xl border border-border shadow-xs hover:border-primary/40 transition">
                {/* Cluster Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border/80">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold shrink-0">
                        {isRtl ? toArabicDigits(idx + 1) : idx + 1}
                      </span>
                      <h4 className="font-bold text-lg text-text-primary leading-snug">
                        {comparison.title}
                      </h4>
                      {anchorVerse && (
                        <Badge variant="gold" size="sm">
                          <Sparkles className="w-3.5 h-3.5 me-1 inline-block" />
                          {t('الموضع في السورة:', 'Position:')} {anchorVerse.surahNameArabic} [الآية {toArabicDigits(anchorVerse.ayahNumber)}]
                        </Badge>
                      )}
                    </div>
                    {comparison.description && (
                      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed ps-9">
                        {comparison.description}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus className="w-3.5 h-3.5 text-primary" />}
                      onClick={() => handleOpenDiffModal(comparison.id)}
                    >
                      {t('رصد فارق لفظي', 'Add Difference')}
                    </Button>

                    <button
                      onClick={() => onDeleteComparison(comparison.id)}
                      className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                      title={t('حذف هذا الموضع', 'Delete Position')}
                      aria-label={t('حذف هذا الموضع', 'Delete Position')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Shared Phrases Callout */}
                {comparison.sharedPhrases && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-accent-tint/60 border border-accent/25">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider block mb-1">
                      {t('الألفاظ والعبارات المشتركة في هذا الموضع:', 'Shared Wording in this Position:')}
                    </span>
                    <p className="text-base font-semibold text-text-primary font-quran">
                      « {comparison.sharedPhrases} »
                    </p>
                  </div>
                )}

                {/* Compared Verses */}
                <div className="space-y-3">
                  {/* 1. Anchor Verse: prominently styled */}
                  {anchorVerse && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('موضع سورة الأساس (المرجع الذي يُقاس عليه):', 'Anchor Verse in Base Surah:')}</span>
                      </span>
                      <div className="p-4 md:p-5 rounded-xl bg-amber-500/10 dark:bg-amber-950/25 border-2 border-amber-500/40 shadow-xs">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="gold" size="sm">
                            <Sparkles className="w-3.5 h-3.5 me-1 inline-block" />
                            {t('موضع السورة الأساس', 'Anchor')}
                          </Badge>
                          <Badge variant="primary" size="sm">
                            {t('سورة', 'Surah')} {anchorVerse.surahNameArabic}
                          </Badge>
                          <Badge variant="charcoal" size="sm">
                            {t('الآية', 'Ayah')} {toArabicDigits(anchorVerse.ayahNumber)}
                          </Badge>
                        </div>
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-quran text-lg md:text-xl text-text-primary text-start leading-[2.5] py-1"
                        >
                          {anchorVerse.uthmaniText}{' '}
                          <span className="ayah-number-badge text-primary font-bold">
                            {formatAyahOrnament(anchorVerse.ayahNumber)}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 2. Other comparative verses */}
                  {otherVerses.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                        {t('المواضع المقابلة في السور الأخرى:', 'Comparative Verses in Other Surahs:')}
                      </span>
                      <div className="grid grid-cols-1 gap-2.5">
                        {otherVerses.map(compVerse => (
                          <div
                            key={compVerse.id}
                            className="p-4 rounded-xl bg-background border border-border"
                          >
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" size="sm">
                                {t('موضع مقارن', 'Compared Verse')}
                              </Badge>
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
                              className="font-quran text-base md:text-lg text-text-primary text-start leading-[2.4] py-1"
                            >
                              {compVerse.uthmaniText}{' '}
                              <span className="ayah-number-badge text-primary font-bold">
                                {formatAyahOrnament(compVerse.ayahNumber)}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Documented Differences List */}
                <div className="pt-2 border-t border-border/80">
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                      {t('الفوارق المرصودة ومواضع الاختلاف لهذا الموضع:', 'Wording Differences for this Position:')}
                    </span>
                    <button
                      onClick={() => handleOpenDiffModal(comparison.id)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{t('إضافة فارق', 'Add Diff')}</span>
                    </button>
                  </div>

                  {comparison.differences.length === 0 ? (
                    <div className="p-3 rounded-lg bg-surface border border-dashed border-border text-center">
                      <p className="text-xs text-text-secondary">
                        {t('لم يُرصد فارق لفظي بعد لهذا الموضع. اضغط «رصد فارق لفظي» لتوثيق الاختلاف.', 'No specific differences added yet. Click Add Difference to document nuances.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {comparison.differences.map(diff => (
                        <div
                          key={diff.id}
                          className="p-3.5 rounded-xl bg-surface border border-border flex items-start justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1.5 text-start flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="accent" size="sm">
                                {t('سورة', 'Surah')} {diff.surahNameArabic} : {t('الآية', 'Ayah')} {toArabicDigits(diff.ayahNumber)}
                              </Badge>
                              <span className="text-xs font-bold text-primary bg-primary-tint px-2.5 py-1 rounded-md border border-primary/20 font-quran">
                                « {diff.selectedText} »
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-text-primary leading-relaxed ps-1">
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
            );
          })}
        </div>
      )}

      {/* Modal: Create Position Cluster */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          baseSurahNameArabic
            ? t(`إضافة موضع متشابه جديد في سورة ${baseSurahNameArabic}`, `Add New Position in Surah ${baseSurahNameArabic}`)
            : t('إضافة موضع متشابه جديد بين الآيات', 'Add New Similar Position')
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveComparison} className="space-y-5 text-start">
          {/* Step 1: Base Verse Selection */}
          <div className="p-4 rounded-xl bg-primary-tint/25 border border-primary/30 space-y-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>
                {baseSurahNameArabic
                  ? t(`١. موضع الآية الأصل في سورة ${baseSurahNameArabic} (المرجع الأساس) *`, `1. Anchor Verse in Surah ${baseSurahNameArabic} *`)
                  : t('١. الآية المرجع الأساسية للمقارنة (الموضع الأصل) *', '1. Anchor Verse *')}
              </span>
            </div>

            {baseSurahVerses.length > 0 ? (
              <Select
                label={t('اختر الآية الكريمة من السورة *', 'Select Verse from Surah *')}
                value={anchorVerseId || ''}
                onChange={e => {
                  const val = Number(e.target.value);
                  setAnchorVerseId(val);
                  const verseObj = baseSurahVerses.find(v => v.id === val);
                  if (verseObj && !title) {
                    setTitle(`موضع الآية ${toArabicDigits(verseObj.ayahNumber)} من سورة ${baseSurahNameArabic}`);
                  }
                }}
                options={baseSurahVerses.map(v => ({
                  value: v.id,
                  label: `الآية ${toArabicDigits(v.ayahNumber)}: ${v.uthmaniText.slice(0, 45)}...`,
                }))}
              />
            ) : (
              <Select
                label={t('اختر الآية المرجع من القائمة *', 'Select Verse *')}
                value={anchorVerseId || ''}
                onChange={e => setAnchorVerseId(Number(e.target.value))}
                options={verses.map(v => ({
                  value: v.quranVerseId,
                  label: `سورة ${v.surahNameArabic} - الآية ${toArabicDigits(v.ayahNumber)}: ${v.uthmaniText.slice(0, 40)}...`,
                }))}
              />
            )}

            {/* Live Preview of Anchor Verse */}
            {activeAnchorPreview && (
              <div className="p-3 rounded-lg bg-surface border border-border/80">
                <span className="text-[11px] font-semibold text-text-secondary block mb-1">
                  {t('نص الآية المرجع:', 'Anchor Verse Text:')}
                </span>
                <p dir="rtl" lang="ar" className="font-quran text-base text-text-primary leading-loose">
                  {activeAnchorPreview.uthmaniText}{' '}
                  <span className="ayah-number-badge text-primary font-bold">
                    {formatAyahOrnament(activeAnchorPreview.ayahNumber)}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Comparative Verses Selection */}
          <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span>{t('٢. الآيات المقابلة لها في السور الأخرى (المواضع الشبيهة)', '2. Comparative Verses in Other Surahs')}</span>
              </span>
              <span className="text-xs text-text-secondary font-medium">
                {t(`المحددة: ${isRtl ? toArabicDigits(selectedOtherVerses.length) : selectedOtherVerses.length}`, `Selected: ${selectedOtherVerses.length}`)}
              </span>
            </div>

            {/* Quick Search for verses */}
            <div className="relative">
              <Search className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-text-secondary pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('ابحث في المصحف عن الآيات الشبيهة (مثال: ولقد استهزئ، يا أيها الذين آمنوا)...', 'Search verses to compare...')}
                className="w-full h-10 ps-9 pe-4 text-xs sm:text-sm bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:border-primary transition text-start"
              />
            </div>

            {/* Search results picker */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-1.5 border border-border/80 rounded-lg bg-background">
                <span className="text-[11px] font-bold text-text-secondary px-1 block">
                  {t('نتائج البحث (اضغط + للإضافة لهذا الموضع):', 'Search results (Click + to add):')}
                </span>
                {searchResults
                  .filter(r => r.id !== anchorVerseId)
                  .map(sv => {
                    const isAdded = selectedOtherVerses.some(item => item.id === sv.id);
                    return (
                      <div
                        key={sv.id}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition ${
                          isAdded ? 'bg-primary-tint/30 border-primary/40' : 'bg-surface border-border hover:border-primary/30'
                        }`}
                      >
                        <div className="flex-1 truncate text-start">
                          <span className="font-bold text-text-primary">
                            [{sv.surahNameArabic}: {toArabicDigits(sv.ayahNumber)}]
                          </span>{' '}
                          <span className="font-quran text-text-secondary">{sv.uthmaniText}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={isAdded ? 'secondary' : 'primary'}
                          className="h-7 text-xs px-2 shrink-0"
                          onClick={() => (isAdded ? handleRemoveComparativeVerse(sv.id) : handleAddComparativeVerse(sv))}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3 h-3 me-1 text-success" />
                              {t('مضاف', 'Added')}
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 me-1" />
                              {t('إضافة', 'Add')}
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Selected Comparative Verses Chips */}
            {selectedOtherVerses.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-text-secondary block">
                  {t('الآيات المضافة للمقارنة في هذا الموضع:', 'Selected comparative verses:')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedOtherVerses.map(v => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border text-xs font-medium text-text-primary"
                    >
                      <span>
                        سورة {v.surahNameArabic} [{toArabicDigits(v.ayahNumber)}]
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveComparativeVerse(v.id)}
                        className="text-text-secondary hover:text-danger p-0.5 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-secondary italic">
                {t('لم تُضف آيات مقابلة بعد. يمكنك البحث في المصحف بالأعلى وإضافتها.', 'No comparative verses added yet. Search Quran above to add.')}
              </p>
            )}
          </div>

          {/* Step 3: Position Details */}
          <div className="space-y-3.5">
            <Input
              label={t('عنوان الموضع أو ملخصه *', 'Position Title *')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('مثال: موضع ولقد استهزئ برسل، نداءات الإيمان', 'e.g. Position of phrase')}
              required
            />

            <Input
              label={t('الألفاظ والعبارات المشتركة في هذا الموضع (اختياري)', 'Shared Phrases (Optional)')}
              value={sharedPhrases}
              onChange={e => setSharedPhrases(e.target.value)}
              placeholder={t('اكتب العبارة أو الكلمات المشتركة بدقة', 'Common wording across verses')}
            />

            <Textarea
              label={t('وصف أو ملاحظات حول هذا الموضع (اختياري)', 'Position Description / Context (Optional)')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('سجل أي سياق أو لمحة بلاغية تود تذكرها لهذا الموضع...', 'Add notes on why these verses were grouped...')}
              rows={2}
            />
          </div>

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
              disabled={!anchorVerseId}
            >
              {t('حفظ الموضع في السورة', 'Save Position')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Difference */}
      <Modal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        title={t('رصد فارق لفظي في موضع محدد', 'Document a Wording Difference')}
        maxWidth="md"
      >
        <form onSubmit={handleSaveDifference} className="space-y-4">
          <Select
            label={t('الآية التي تحتوي الفارق *', 'Verse with Difference *')}
            value={diffVerseId}
            onChange={e => setDiffVerseId(Number(e.target.value))}
            options={(() => {
              const activeCmp = comparisons.find(c => c.id === activeComparisonId);
              const targetVerses = activeCmp?.verses?.length ? activeCmp.verses : verses;
              return targetVerses.map(v => ({
                value: v.quranVerseId,
                label: `${t('سورة', 'Surah')} ${v.surahNameArabic} - ${t('الآية', 'Ayah')} ${toArabicDigits(v.ayahNumber)}`,
              }));
            })()}
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
