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
import { Skeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { Plus, Trash2, ChevronUp, ChevronDown, BookOpen, Search, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getFullVersesByIds } from '@/offline/quranDb';
import { searchLocalWorker } from '@/offline/searchWorkerClient';
import {
  setCachedCollectionDetail,
  setCachedUserCollections,
  getCachedUserCollections,
  enqueueOutboxOperation,
} from '@/offline/userDataDb';

export const CreateCollectionPage: React.FC = () => {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVerses, setSelectedVerses] = useState<QuranVerse[]>([]);
  const [isLoadingInitialVerses, setIsLoadingInitialVerses] = useState(false);

  // Quick Verse Search Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const isRtl = direction === 'rtl';
  const { user } = useAuth();

  // Read verses param from URL (e.g. ?verses=1,2,3)
  useEffect(() => {
    const versesParam = searchParams.get('verses');
    if (versesParam) {
      const ids = versesParam.split(',').map(Number).filter(id => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        setIsLoadingInitialVerses(true);
        if (!navigator.onLine) {
          getFullVersesByIds(ids)
            .then(loadedVerses => {
              setSelectedVerses(loadedVerses);
            })
            .catch(() => {
              toast.error(t('تعذر تحميل بعض الآيات المحددة.', 'Failed to load some selected verses.'));
            })
            .finally(() => {
              setIsLoadingInitialVerses(false);
            });
        } else {
          Promise.all(ids.map(id => api.get<QuranVerse>(`/quran/verses/${id}`).then(res => res.data)))
            .then(loadedVerses => {
              setSelectedVerses(loadedVerses);
            })
            .catch(async () => {
              const localVerses = await getFullVersesByIds(ids);
              if (localVerses.length > 0) {
                setSelectedVerses(localVerses);
              } else {
                toast.error(t('تعذر تحميل بعض الآيات المحددة.', 'Failed to load some selected verses.'));
              }
            })
            .finally(() => {
              setIsLoadingInitialVerses(false);
            });
        }
      }
    }
  }, [searchParams]);

  // Modal verse search query
  const { data: modalSearchResults, isFetching: isSearchingModal } = useQuery<QuranVerse[]>({
    queryKey: ['modalVerseSearch', modalSearchQuery],
    queryFn: async () => {
      if (!modalSearchQuery.trim()) return [];
      if (!navigator.onLine) {
        const localRes = await searchLocalWorker({ q: modalSearchQuery.trim(), pageSize: 10 });
        return localRes.items;
      }
      try {
        const res = await api.get<{ items: QuranVerse[] }>(`/quran/search?q=${encodeURIComponent(modalSearchQuery.trim())}&pageSize=10`);
        return res.data.items;
      } catch {
        const localRes = await searchLocalWorker({ q: modalSearchQuery.trim(), pageSize: 10 });
        return localRes.items;
      }
    },
    enabled: isSearchModalOpen && modalSearchQuery.trim().length > 1,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        quranVerseIds: selectedVerses.map(v => v.id),
      };

      if (!navigator.onLine) {
        if (!user) throw new Error(t('يرجى تسجيل الدخول أولاً', 'Please sign in first'));
        const tempId = `temp-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const collectionDetail: any = {
          id: tempId,
          userId: user.id,
          title: payload.title,
          description: payload.description,
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

        return { id: tempId, isOffline: true };
      }

      const res = await api.post('/collections', payload);
      if (user) {
        await setCachedCollectionDetail(user.id, res.data);
      }
      return res.data;
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
    <div className="max-w-4xl mx-auto space-y-6 pb-16 text-start animate-fade-in">
      {/* Top Header */}
      <PageHeader
        title={t('إنشاء مجموعة متشابهات جديدة', 'Create Similarity Collection')}
        description={t(
          'اكتب عنواناً معبراً للمجموعة، ورتب الآيات المتشابهة لتتمكن لاحقاً من مقارنتها وتدوين روابطها.',
          'Name your collection, arrange the verses, and document relationships.'
        )}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            icon={isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          >
            {t('رجوع', 'Back')}
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Collection Metadata Card */}
        <Card className="space-y-4">
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
            rows={3}
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
            <div className="space-y-3">
              {selectedVerses.map((verse, index) => (
                <Card
                  key={verse.id}
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
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
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
