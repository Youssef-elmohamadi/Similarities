import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { CollectionDetail } from '@/types/collection';
import { Button } from '@/components/common/Button';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Seo } from '@/components/common/Seo';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { toArabicDigits } from '@/lib/utils';
import { getQuranDB, CompactSurah } from '@/offline/quranDb';
import {
  getCachedCollectionDetail,
  setCachedCollectionDetail,
  getCachedUserCollections,
  setCachedUserCollections,
  enqueueOutboxOperation,
} from '@/offline/userDataDb';
import { outboxSyncManager } from '@/offline/outboxSyncManager';
import { connectivity } from '@/offline/connectivity';
import { ArrowRight, ArrowLeft, BookOpen, Layers, Sparkles } from 'lucide-react';

export const EditCollectionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, direction } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [collectionType, setCollectionType] = useState<'surah' | 'custom'>('custom');
  const [selectedSurahId, setSelectedSurahId] = useState<number>(1);

  const isRtl = direction === 'rtl';

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

  const { data: collection, isLoading } = useQuery<CollectionDetail>({
    queryKey: ['collection', id, user?.id],
    networkMode: 'always',
    queryFn: async () => {
      if (!id) throw new Error('Missing ID');
      if (!user) throw new Error('Not logged in');

      const cached = await getCachedCollectionDetail(user.id, id);

      // Trigger background revalidation if online
      if (connectivity.isOnline()) {
        (async () => {
          try {
            const res = await api.get<CollectionDetail>(`/collections/${id}`);
            if (user) {
              await setCachedCollectionDetail(user.id, res.data);
              queryClient.setQueryData(['collection', id, user.id], res.data);
            }
          } catch {
            // background network failure ignored; local data authoritative
          }
        })();
      }

      if (cached) {
        return cached as unknown as CollectionDetail;
      }

      if (connectivity.isOnline()) {
        const res = await api.get<CollectionDetail>(`/collections/${id}`);
        if (user) {
          await setCachedCollectionDetail(user.id, res.data);
        }
        return res.data;
      }

      throw new Error('Collection not found in offline cache');
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (collection) {
      setTitle(collection.title);
      setDescription(collection.description || '');
      if (collection.baseSurahId) {
        setCollectionType('surah');
        setSelectedSurahId(collection.baseSurahId);
      } else {
        setCollectionType('custom');
      }
    }
  }, [collection]);

  const updateMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      if (!user || !id) throw new Error('Not logged in');
      const online = connectivity.isOnline();
      const selectedSurah = surahs.find(s => s.id === Number(selectedSurahId) || s.number === Number(selectedSurahId));
      const baseSurahId = collectionType === 'surah' ? (selectedSurah?.id || Number(selectedSurahId)) : null;
      const baseSurahNameArabic = collectionType === 'surah' ? selectedSurah?.nameArabic : undefined;

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        baseSurahId: baseSurahId,
      };

      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const baseUpdatedAt = current.updatedAt;
        current.title = payload.title;
        current.description = payload.description;
        current.baseSurahId = payload.baseSurahId || undefined;
        current.baseSurahNameArabic = baseSurahNameArabic;
        current.updatedAt = new Date().toISOString();
        await setCachedCollectionDetail(user.id, current);

        const list = await getCachedUserCollections(user.id);
        const idx = list.findIndex(c => c.id === id);
        if (idx !== -1) {
          list[idx].title = payload.title;
          list[idx].description = payload.description;
          list[idx].baseSurahId = payload.baseSurahId || undefined;
          list[idx].baseSurahNameArabic = baseSurahNameArabic;
          list[idx].updatedAt = current.updatedAt;
          await setCachedUserCollections(user.id, list);
        }

        if (!id.startsWith('temp-')) {
          await enqueueOutboxOperation({
            id: crypto.randomUUID(),
            userId: user.id,
            type: 'UPDATE_COLLECTION',
            entityId: id,
            payload,
            baseUpdatedAt,
            timestamp: Date.now(),
            status: 'PENDING',
          });
        }
      }

      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }

      return { isOffline: !online };
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      if (res?.isOffline) {
        toast.info(t('تم تحديث المجموعة محلياً — في انتظار المزامنة.', 'Updated locally — pending sync.'));
      } else {
        toast.success(t('تم تحديث بيانات المجموعة بنجاح.', 'Collection updated successfully.'));
      }
      navigate(`/collections/${id}`);
    },
    onError: err => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 py-8 text-start">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3.5 sm:space-y-6 pb-28 md:pb-16 text-start animate-fade-in">
      <Seo title="تعديل المجموعة" robots="noindex, nofollow" />

      {/* Top Header: Compact on Mobile */}
      <PageHeader
        title={t('تعديل بيانات المجموعة', 'Edit Collection')}
        description={t('تحديث عنوان ووصف المجموعة القرآنية', 'Update collection title and description')}
        onBack={() => navigate(`/collections/${id}`)}
      />

      <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-6">
        {/* Collection Type Selector */}
        <div className="space-y-1.5 sm:space-y-2.5">
          <label className="block text-xs sm:text-sm font-semibold text-text-primary">
            {t('نوع المجموعة الهيكلي', 'Collection Structure Type')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div
              onClick={() => setCollectionType('surah')}
              className={`cursor-pointer p-2.5 sm:p-3.5 rounded-xl border-2 transition-all flex items-start gap-2 sm:gap-3 ${
                collectionType === 'surah'
                  ? 'border-primary bg-primary-tint/30 shadow-xs'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${collectionType === 'surah' ? 'bg-primary text-white' : 'bg-charcoal-100 text-text-secondary'}`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-text-primary text-xs sm:text-sm block leading-tight">
                  <span className="sm:hidden">{t('مجموعة سورة', 'Surah-Based')}</span>
                  <span className="hidden sm:inline">{t('مجموعة سورة (المرجع سورة محددة)', 'Surah-Based')}</span>
                </span>
                <p className="hidden sm:block text-xs text-text-secondary">
                  {t('مربوطة بسورة مرجعية تقاس عليها باقي السور', 'Anchored to a specific base Surah')}
                </p>
              </div>
            </div>

            <div
              onClick={() => setCollectionType('custom')}
              className={`cursor-pointer p-2.5 sm:p-3.5 rounded-xl border-2 transition-all flex items-start gap-2 sm:gap-3 ${
                collectionType === 'custom'
                  ? 'border-primary bg-primary-tint/30 shadow-xs'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className={`p-1.5 sm:p-2 rounded-lg shrink-0 ${collectionType === 'custom' ? 'bg-primary text-white' : 'bg-charcoal-100 text-text-secondary'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <span className="font-bold text-text-primary text-xs sm:text-sm block leading-tight">
                  <span className="sm:hidden">{t('مجموعة موضوعية', 'Thematic')}</span>
                  <span className="hidden sm:inline">{t('مجموعة موضوعية / حرة', 'Thematic / Custom')}</span>
                </span>
                <p className="hidden sm:block text-xs text-text-secondary">
                  {t('متشابهات عامة حول موضوع أو ألفاظ محددة', 'Cross-Quran topical grouping')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Base Surah Selector (when Surah type is active) */}
        {collectionType === 'surah' && (
          <Card className="p-2.5 sm:p-4 bg-primary-tint/20 border-primary/30 space-y-1.5 sm:space-y-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2 text-primary font-semibold text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
              <span>{t('السورة الأساس (المرجع لهذه المجموعة)', 'Anchor Surah')}</span>
            </div>
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

        <Card className="space-y-4">
          <Input
            label={t('عنوان المجموعة *', 'Collection Title *')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label={t('الوصف أو الملاحظات (اختياري)', 'Description (Optional)')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />
        </Card>

        {/* Desktop Buttons (>= 768px) */}
        <div className="hidden md:flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/collections/${id}`)}
          >
            {t('إلغاء', 'Cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            disabled={!title.trim()}
          >
            {t('حفظ التعديلات', 'Save Changes')}
          </Button>
        </div>

        {/* Mobile Sticky Save Bar (< 768px) */}
        <div className="md:hidden fixed bottom-14 inset-x-0 z-20 bg-surface/95 backdrop-blur-md border-t border-border p-2.5 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1 min-h-[44px]"
            onClick={() => navigate(`/collections/${id}`)}
          >
            {t('إلغاء', 'Cancel')}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="flex-1 min-h-[44px]"
            isLoading={updateMutation.isPending}
            disabled={!title.trim()}
          >
            {t('حفظ التعديلات', 'Save Changes')}
          </Button>
        </div>
      </form>
    </div>
  );
};
