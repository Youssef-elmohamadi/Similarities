import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { QuranVerse } from '@/types/quran';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { ListRow } from '@/components/common/ListRow';
import { Skeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Seo } from '@/components/common/Seo';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { Plus, Trash2, ChevronUp, ChevronDown, BookOpen, Search, ArrowRight, ArrowLeft, Layers, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFullVersesByIds, isOfflineDatasetAvailable, getQuranDB, CompactSurah } from '@/offline/quranDb';
import { Select } from '@/components/common/Input';
import { searchLocalWorker } from '@/offline/searchWorkerClient';
import {
  setCachedCollectionDetail,
  setCachedUserCollections,
  getCachedUserCollections,
  enqueueOutboxOperation,
} from '@/offline/userDataDb';
import { outboxSyncManager } from '@/offline/outboxSyncManager';
import { connectivity } from '@/offline/connectivity';

export const CreateCollectionPage: React.FC = () => {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collectionType, setCollectionType] = useState<'surah' | 'custom'>('surah');
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);
  const [selectedVerses, setSelectedVerses] = useState<QuranVerse[]>([]);
  const [isLoadingInitialVerses, setIsLoadingInitialVerses] = useState(false);

  // Quick Verse Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const isRtl = direction === 'rtl';
  const { user } = useAuth();

  // Load all Surahs for base surah selection
  const { data: surahs = [] } = useQuery<CompactSurah[]>({
    queryKey: ['surahsList'],
    networkMode: 'always',
    queryFn: async () => {
      try {
        const db = await getQuranDB();
        const localSurahs = await db.getAll('surahs');
        if (localSurahs && localSurahs.length > 0) {
          return localSurahs.sort((a, b) => a.number - b.number);
        }
      } catch (e) {
        console.warn('Failed to get surahs from indexedDB', e);
      }
      if (connectivity.isOnline()) {
        try {
          const res = await api.get<any[]>('/quran/surahs');
          return res.data;
        } catch (e) {
          console.warn('Failed to get surahs from API', e);
        }
      }
      return [];
    },
  });

  // If initial verses were loaded from URL, auto-align the base surah
  useEffect(() => {
    if (selectedVerses.length > 0 && collectionType === 'surah') {
      const firstSurahId = selectedVerses[0].surahId;
      if (firstSurahId && !title) {
        setSelectedSurahId(firstSurahId);
      }
    }
  }, [selectedVerses]);

  // Auto-suggest title when surah changes and user hasn't typed custom title
  useEffect(() => {
    if (collectionType === 'surah' && surahs.length > 0) {
      const s = surahs.find(item => item.id === Number(selectedSurahId) || item.number === Number(selectedSurahId));
      if (s) {
        setTitle(prev => (!prev || prev.startsWith('متشابهات سورة ') ? `متشابهات سورة ${s.nameArabic}` : prev));
      }
    }
  }, [collectionType, selectedSurahId, surahs]);

  // Read verses param from URL (e.g. ?verses=1,2,3)
  useEffect(() => {
    const versesParam = searchParams.get('verses');
    if (versesParam) {
      const ids = versesParam.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        setIsLoadingInitialVerses(true);
        getFullVersesByIds(ids)
          .then(async loadedVerses => {
            if (loadedVerses.length === ids.length || !connectivity.isOnline()) {
              setSelectedVerses(loadedVerses);
            } else {
              try {
                const apiVerses = await Promise.all(ids.map(id => api.get<QuranVerse>(`/quran/verses/${id}`).then(res => res.data)));
                setSelectedVerses(apiVerses);
              } catch {
                setSelectedVerses(loadedVerses);
              }
            }
          })
          .catch(() => {
            toast.error(t('تعذر تحميل بعض الآيات المحددة.', 'Failed to load some selected verses.'));
          })
          .finally(() => {
            setIsLoadingInitialVerses(false);
          });
      }
    }
  }, [searchParams]);

  // Modal verse search query
  const { data: modalSearchResults, isFetching: isSearchingModal } = useQuery<QuranVerse[]>({
    networkMode: 'always',
    queryKey: ['modalVerseSearch', modalSearchQuery],
    queryFn: async () => {
      if (!modalSearchQuery.trim()) return [];
      try {
        const localRes = await searchLocalWorker({ q: modalSearchQuery.trim(), pageSize: 10 });
        return localRes.items;
      } catch (e) {
        console.warn('Local search in modal failed:', e);
      }
      if (connectivity.isOnline()) {
        try {
          const res = await api.get<{ items: QuranVerse[] }>(`/quran/search?q=${encodeURIComponent(modalSearchQuery.trim())}&pageSize=10`);
          return res.data.items;
        } catch {
          // ignore
        }
      }
      return [];
    },
    enabled: isSearchModalOpen && modalSearchQuery.trim().length > 1,
  });

  const createMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      const selectedSurah = surahs.find(s => s.id === Number(selectedSurahId) || s.number === Number(selectedSurahId));
      const baseSurahId = collectionType === 'surah' ? (selectedSurah?.id || Number(selectedSurahId)) : undefined;
      const baseSurahNameArabic = collectionType === 'surah' ? selectedSurah?.nameArabic : undefined;

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        baseSurahId: baseSurahId,
        quranVerseIds: selectedVerses.map(v => v.id),
      };

      if (!user) throw new Error(t('يرجى تسجيل الدخول أولاً', 'Please sign in first'));
      const online = connectivity.isOnline();
      const tempId = `temp-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const collectionDetail: any = {
        id: tempId,
        userId: user.id,
        title: payload.title,
        description: payload.description,
        baseSurahId: payload.baseSurahId,
        baseSurahNameArabic: baseSurahNameArabic,
        createdAt: now,
        updatedAt: now,
        verses: selectedVerses.map((v, idx) => ({
          id: `temp-v-${crypto.randomUUID()}`,
          collectionId: tempId,
          quranVerseId: v.id,
          displayOrder: idx + 1,
          addedAt: now,
          surahId: v.surahId,
          surahNumber: (v as any).surahNumber || v.surahId,
          surahNameArabic: v.surahNameArabic,
          surahNameEnglish: v.surahNameEnglish,
          ayahNumber: v.ayahNumber,
          uthmaniText: v.uthmaniText,
        })),
        comparisons: [],
        connections: [],
        notes: [],
      };

      const collectionSummary: any = {
        id: tempId,
        userId: user.id,
        title: payload.title,
        description: payload.description,
        baseSurahId: payload.baseSurahId,
        baseSurahNameArabic: baseSurahNameArabic,
        verseCount: selectedVerses.length,
        comparisonCount: 0,
        connectionCount: 0,
        createdAt: now,
        updatedAt: now,
        surahNames: Array.from(new Set(selectedVerses.map(v => v.surahNameArabic))),
      };

      await setCachedCollectionDetail(user.id, collectionDetail);
      const existingColls = await getCachedUserCollections(user.id);
      await setCachedUserCollections(user.id, [collectionSummary, ...existingColls]);

      await enqueueOutboxOperation({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'CREATE_COLLECTION',
        entityId: tempId,
        payload,
        timestamp: Date.now(),
        status: 'PENDING',
      });

      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }

      return { id: tempId, isOffline: !online };
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (data.isOffline) {
        toast.info(t('تم حفظ المجموعة محلياً — ستتم المزامنة تلقائياً عند الاتصال بالإنترنت.', 'Saved locally — will sync automatically when back online.'));
      } else {
        toast.success(t('تم إنشاء مجموعة المتشابهات بنجاح!', 'Collection created successfully!'));
      }
      navigate(`/collections/${data.id}`);
    },
    onError: err => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleAddVerseFromSearch = (verse: QuranVerse) => {
    if (selectedVerses.some(v => v.id === verse.id)) {
      toast.warning(t('الآية مضافة بالفعل إلى القائمة.', 'Verse already in collection.'));
      return;
    }
    setSelectedVerses(prev => [...prev, verse]);
    toast.success(t('تمت إضافة الآية.', 'Verse added.'));
  };

  const handleRemoveVerse = (verseId: number) => {
    setSelectedVerses(prev => prev.filter(v => v.id !== verseId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...selectedVerses];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setSelectedVerses(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedVerses.length - 1) return;
    const newItems = [...selectedVerses];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setSelectedVerses(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('يرجى كتابة عنوان للمجموعة.', 'Please enter collection title.'));
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 sm:space-y-6 pb-16 text-start animate-fade-in">
      <Seo title="إنشاء مجموعة جديدة" robots="noindex, nofollow" />
      {/* Top Header: Compact on Mobile */}
      <PageHeader
        title={t('إنشاء مجموعة متشابهات جديدة', 'Create Similarity Collection')}
        description={t(
          'اكتب عنواناً معبراً للمجموعة، ورتب الآيات المتشابهة لتتمكن لاحقاً من مقارنتها وتدوين روابطها.',
          'Name your collection, arrange the verses, and document relationships.'
        )}
        onBack={() => navigate(-1)}
      />

      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-6">
        {/* Collection Type Selector: Side-by-side on mobile */}
        <div className="space-y-1.5 sm:space-y-2.5">
          <label className="block text-xs sm:text-sm font-semibold text-text-primary">
            {t('نوع المجموعة الهيكلي', 'Collection Structure Type')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
            {/* Surah-based option */}
            <div
              onClick={() => setCollectionType('surah')}
              className={`cursor-pointer p-2.5 sm:p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                collectionType === 'surah'
                  ? 'border-primary bg-primary-tint/30 shadow-xs'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${collectionType === 'surah' ? 'bg-primary text-white' : 'bg-charcoal-100 text-text-secondary'}`}>
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-text-primary text-xs sm:text-base leading-tight">
                      <span className="sm:hidden">{t('مجموعة سورة', 'Surah-Based')}</span>
                      <span className="hidden sm:inline">{t('مجموعة سورة (المرجع سورة محددة)', 'Surah-Based Collection')}</span>
                    </span>
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold whitespace-nowrap">
                      {t('الأنسب للحفظ', 'Recommended')}
                    </span>
                  </div>
                  <p className="hidden sm:block text-xs text-text-secondary leading-relaxed">
                    {t(
                      'تُربط المجموعة بسورة محددة؛ فتكون مواضعها هي الأساس، وتُبنى عليها المقارنات مع السور الأخرى.',
                      'Anchored to a specific Surah whose verses act as the base against other surahs.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom/Thematic option */}
            <div
              onClick={() => setCollectionType('custom')}
              className={`cursor-pointer p-2.5 sm:p-4 rounded-xl border-2 transition-all flex flex-col justify-between ${
                collectionType === 'custom'
                  ? 'border-primary bg-primary-tint/30 shadow-xs'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${collectionType === 'custom' ? 'bg-primary text-white' : 'bg-charcoal-100 text-text-secondary'}`}>
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <span className="font-bold text-text-primary text-xs sm:text-base leading-tight block">
                    <span className="sm:hidden">{t('مجموعة موضوعية', 'Thematic')}</span>
                    <span className="hidden sm:inline">{t('مجموعة موضوعية / حرة', 'Thematic / Custom Collection')}</span>
                  </span>
                  <p className="hidden sm:block text-xs text-text-secondary leading-relaxed">
                    {t(
                      'لجمع المتشابهات حول موضوع أو لفظ محدد عبر سور متعددة دون التقيد بسورة مرجع واحدة.',
                      'A flexible collection grouping verses across multiple surahs by topic or recurring phrase.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Base Surah Selector (when Surah type is active) */}
        {collectionType === 'surah' && (
          <Card className="p-2.5 sm:p-5 bg-primary-tint/20 border-primary/30 space-y-1.5 sm:space-y-3">
            <div className="flex items-center gap-1.5 sm:gap-2 text-primary font-semibold text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
              <span>{t('اختر السورة الأساس (المرجع لهذه المجموعة)', 'Choose the Anchor Surah')}</span>
            </div>
            <p className="hidden sm:block text-xs text-text-secondary leading-relaxed">
              {t(
                'آيات هذه السورة ستكون هي المرجع الأساسي، وكل مقارنة ستشمل موضعاً من هذه السورة ومواضعه الشبيهة في السور الأخرى.',
                'Verses from this Surah will serve as the primary anchor for all comparisons in this collection.'
              )}
            </p>
            <Select
              value={selectedSurahId}
              onChange={e => setSelectedSurahId(Number(e.target.value))}
              options={surahs.map(s => ({
                value: s.id,
                label: `${isRtl ? toArabicDigits(s.number) : s.number}. سورة ${s.nameArabic} (${isRtl ? toArabicDigits(s.ayahCount) : s.ayahCount} آية) - ${s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}`,
              }))}
            />
          </Card>
        )}

        {/* Collection Metadata Card */}
        <Card className="p-3 sm:p-5 space-y-3 sm:space-y-4">
          <Input
            label={t('عنوان المجموعة *', 'Collection Title *')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('مثال: متشابهات (إِنَّ الَّذِينَ كَفَرُوا)، المسارعة في الخيرات', 'e.g. Verses containing a specific phrase')}
            required
            autoFocus
          />

          <Textarea
            label={t('وصف أو ملاحظات عامة للمجموعة (اختياري)', 'Description (Optional)')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t('اكتب نبذة أو ملاحظات تود تذكرها حول هذه المجموعة من المتشابهات...', 'Add any general summary or context...')}
            rows={2}
          />
        </Card>

        {/* Selected Verses Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary leading-snug">
                {t('الآيات المشمولة في المجموعة', 'Included Verses')}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {t(
                  `العدد: ${isRtl ? toArabicDigits(selectedVerses.length) : selectedVerses.length} آية كريمة`,
                  `Count: ${selectedVerses.length} verse(s)`
                )}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Search className="w-4 h-4 text-primary" />}
              onClick={() => setIsSearchModalOpen(true)}
            >
              {t('إضافة آية من المصحف', 'Add Verse from Quran')}
            </Button>
          </div>

          {isLoadingInitialVerses ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Card key={i} className="p-5 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                </Card>
              ))}
            </div>
          ) : selectedVerses.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <BookOpen className="w-10 h-10 text-text-secondary/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-text-primary">
                {t('لم تختر آيات بعد لهذه المجموعة', 'No verses selected yet')}
              </p>
              <p className="text-xs text-text-secondary mt-1 mb-4">
                {t('يمكنك إضافة آيات الآن أو حفظ المجموعة وإضافة الآيات لاحقاً.', 'You can add verses now or later.')}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Search className="w-4 h-4" />}
                onClick={() => setIsSearchModalOpen(true)}
              >
                {t('ابحث وأضف آية', 'Search & Add Verse')}
              </Button>
            </Card>
          ) : (
            <>
              {/* Desktop Cards (>= 768px) - 100% Unchanged */}
              <div className="hidden md:block space-y-3">
                {selectedVerses.map((verse, index) => (
                  <div key={verse.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '150px' }}>
                    <Card
                      className="p-4 md:p-5 border-border hover:border-primary/40 transition duration-150"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-6 h-6 rounded-md bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {isRtl ? toArabicDigits(index + 1) : index + 1}
                          </span>
                          <Badge variant="primary" size="sm">
                            {t('سورة', 'Surah')} {verse.surahNameArabic}
                          </Badge>
                          <Badge variant="charcoal" size="sm">
                            {t('الآية', 'Ayah')} {toArabicDigits(verse.ayahNumber)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                            title={t('تحريك لأعلى', 'Move Up')}
                            aria-label={t('تحريك لأعلى', 'Move Up')}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === selectedVerses.length - 1}
                            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                            title={t('تحريك لأسفل', 'Move Down')}
                            aria-label={t('تحريك لأسفل', 'Move Down')}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveVerse(verse.id)}
                            className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                            title={t('حذف من القائمة', 'Remove')}
                            aria-label={t('حذف من القائمة', 'Remove')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-quran text-lg md:text-xl text-text-primary text-start leading-[2.5] py-1 selection:bg-accent-tint"
                      >
                        {verse.uthmaniText}{' '}
                        <span className="ayah-number-badge text-primary font-bold">
                          {formatAyahOrnament(verse.ayahNumber)}
                        </span>
                      </p>
                    </Card>
                  </div>
                ))}
              </div>

              {/* Mobile High-Density ListRows (< 768px) */}
              <div className="md:hidden divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
                {selectedVerses.map((verse, index) => (
                  <div key={verse.id} style={{ contentVisibility: 'auto', containIntrinsicSize: '52px' }}>
                    <ListRow
                      index={index + 1}
                      title={`${t('سورة', 'Surah')} ${verse.surahNameArabic} (${isRtl ? toArabicDigits(verse.ayahNumber) : verse.ayahNumber})`}
                      subtitle={verse.uthmaniText}
                      actions={
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-20"
                            aria-label={t('تحريك لأعلى', 'Move Up')}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === selectedVerses.length - 1}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-20"
                            aria-label={t('تحريك لأسفل', 'Move Down')}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveVerse(verse.id)}
                            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-danger hover:bg-danger-subtle"
                            aria-label={t('حذف من القائمة', 'Remove')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons: Desktop bottom vs Mobile sticky */}
        <div className="hidden md:flex pt-4 items-center justify-end gap-3 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/library')}
          >
            {t('إلغاء', 'Cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={createMutation.isPending}
            disabled={!title.trim()}
          >
            {t('حفظ وإنشاء المجموعة', 'Save Collection')}
          </Button>
        </div>

        {/* Mobile Sticky Bottom Save Bar */}
        <div className="md:hidden fixed bottom-14 inset-x-0 z-20 bg-surface/95 backdrop-blur-md border-t border-border p-2.5 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 min-h-[44px]"
            onClick={() => navigate('/library')}
          >
            {t('إلغاء', 'Cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="flex-1 min-h-[44px]"
            isLoading={createMutation.isPending}
            disabled={!title.trim()}
          >
            {t('حفظ وإنشاء المجموعة', 'Save Collection')}
          </Button>
        </div>
      </form>

      {/* Quick Verse Search Modal */}
      <Modal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        title={t('البحث عن آية لإضافتها للمجموعة', 'Search Verse to Add')}
        maxWidth="lg"
      >
        <div className="space-y-4 text-start">
          <div className="relative">
            <Search className="absolute inset-y-0 start-3.5 my-auto w-4 h-4 text-text-secondary/70 pointer-events-none" />
            <input
              type="text"
              value={modalSearchQuery}
              onChange={e => setModalSearchQuery(e.target.value)}
              placeholder={t('اكتب كلمة أو آية للبحث...', 'Search words in Quran...')}
              className="w-full h-11 ps-10 pe-4 text-sm bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 text-start"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {isSearchingModal ? (
              <div className="p-4 text-center text-xs text-text-secondary">
                {t('جارٍ البحث في المصحف...', 'Searching...')}
              </div>
            ) : modalSearchResults && modalSearchResults.length > 0 ? (
              modalSearchResults.map(v => {
                const alreadyExists = selectedVerses.some(sv => sv.id === v.id);
                return (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-lg border border-border/80 hover:bg-background flex items-center justify-between gap-3 text-xs transition"
                  >
                    <div className="flex-1 min-w-0 text-start">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="primary" size="sm">
                          {t('سورة', 'Surah')} {v.surahNameArabic}
                        </Badge>
                        <Badge variant="charcoal" size="sm">
                          {t('الآية', 'Ayah')} {toArabicDigits(v.ayahNumber)}
                        </Badge>
                      </div>
                      <p
                        dir="rtl"
                        lang="ar"
                        className="font-quran text-base text-text-primary truncate"
                      >
                        {v.uthmaniText}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={alreadyExists ? 'secondary' : 'primary'}
                      disabled={alreadyExists}
                      onClick={() => handleAddVerseFromSearch(v)}
                      icon={alreadyExists ? undefined : <Plus className="w-3.5 h-3.5" />}
                    >
                      {alreadyExists ? t('مضافة', 'Added') : t('إضافة', 'Add')}
                    </Button>
                  </div>
                );
              })
            ) : modalSearchQuery.trim().length > 1 ? (
              <p className="text-center text-xs text-text-secondary py-6">
                {t('لا توجد نتائج مطابقة', 'No matching verses found')}
              </p>
            ) : (
              <p className="text-center text-xs text-text-secondary py-6">
                {t('اكتب حرفين على الأقل للبحث السريع في المصحف.', 'Type at least 2 characters to search.')}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
