import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { CollectionDetail } from '@/types/collection';
import { ConnectionType } from '@/types/connection';
import { VerseDifference } from '@/types/comparison';
import { ComparisonEditor } from '@/components/editor/ComparisonEditor';
import { MemorizationConnectionsEditor } from '@/components/editor/MemorizationConnectionsEditor';
import { PersonalNotesEditor } from '@/components/editor/PersonalNotesEditor';

const ExportPdfModal = React.lazy(() =>
  import('@/components/collection/ExportPdfModal').then(m => ({ default: m.ExportPdfModal }))
);
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Skeleton } from '@/components/common/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { Seo } from '@/components/common/Seo';
import { useLanguage } from '@/context/LanguageContext';
import { formatRelativeTime, toArabicDigits, cn } from '@/lib/utils';
import {
  BookMarked,
  BookOpen,
  GitCompare,
  Sparkles,
  FileText,
  Clock,
  Edit3,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Search,
  CheckCircle2,
  Loader2,
  FileDown,
  MoreVertical,
} from 'lucide-react';
import { QuranVerse } from '@/types/quran';
import { useAuth } from '@/context/AuthContext';
import { searchLocalWorker } from '@/offline/searchWorkerClient';
import { getFullVerseById, getFullVersesByIds, isOfflineDatasetAvailable } from '@/offline/quranDb';
import {
  getCachedCollectionDetail,
  setCachedCollectionDetail,
  enqueueOutboxOperation,
  getUserDB,
} from '@/offline/userDataDb';
import { outboxSyncManager } from '@/offline/outboxSyncManager';
import { connectivity, useNetworkStatus } from '@/offline/connectivity';

export const CollectionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'comparisons' | 'connections' | 'notes'>('comparisons');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateComparisonOpen, setIsCreateComparisonOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileDescExpanded, setIsMobileDescExpanded] = useState(false);

  // Add Verse Quick Search Modal
  const [isAddVerseModalOpen, setIsAddVerseModalOpen] = useState(false);
  const [verseSearchQuery, setVerseSearchQuery] = useState('');

  // Export to PDF State
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [exportComparisonId, setExportComparisonId] = useState<string | undefined>(undefined);
  const isOnline = useNetworkStatus();

  const isRtl = direction === 'rtl';
  const { user } = useAuth();

  const { data: collection, isLoading, error } = useQuery<CollectionDetail>({
    queryKey: ['collection', id, user?.id],
    networkMode: 'always',
    queryFn: async () => {
      if (!id) throw new Error('Missing ID');
      if (!user) throw new Error('Not logged in');

      const { isTombstoned } = await import('@/offline/userDataDb');
      if (await isTombstoned(user.id, id)) {
        throw new Error('Collection was deleted locally');
      }

      const cached = await getCachedCollectionDetail(user.id, id);

      // Local-first: trigger non-blocking background revalidation if online
      if (connectivity.isOnline()) {
        (async () => {
          try {
            const res = await api.get<CollectionDetail>(`/collections/${id}`);
            if (user) {
              await setCachedCollectionDetail(user.id, res.data);
              queryClient.setQueryData(['collection', id, user.id], res.data);
            }
          } catch {
            // Background network refresh failed silently; local data remains authoritative
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

  // Modal Verse Search
  const { data: searchVerses, isFetching: isSearching } = useQuery<QuranVerse[]>({
    networkMode: 'always',
    queryKey: ['addVerseSearch', verseSearchQuery],
    queryFn: async () => {
      if (!verseSearchQuery.trim()) return [];
      try {
        const local = await searchLocalWorker({ q: verseSearchQuery.trim(), pageSize: 10 });
        return local.items;
      } catch (e) {
        console.warn('Local search in modal failed:', e);
      }
      if (connectivity.isOnline()) {
        try {
          const res = await api.get<{ items: QuranVerse[] }>(`/quran/search?q=${encodeURIComponent(verseSearchQuery.trim())}&pageSize=10`);
          return res.data.items;
        } catch {
          // ignore
        }
      }
      return [];
    },
    enabled: isAddVerseModalOpen && verseSearchQuery.trim().length > 1,
  });

  // Verse mutations
  const addVerseMutation = useMutation({
    networkMode: 'always',
    onMutate: async (quranVerseId: number) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const v = await getFullVerseById(quranVerseId);
        if (v) {
          const optimisticVerse = {
            id: `temp-v-${crypto.randomUUID()}`,
            collectionId: id,
            quranVerseId: v.id,
            displayOrder: (previous.verses?.length || 0) + 1,
            addedAt: new Date().toISOString(),
            surahId: v.surahId,
            surahNumber: v.surahNumber,
            surahNameArabic: v.surahNameArabic,
            surahNameEnglish: v.surahNameEnglish,
            ayahNumber: v.ayahNumber,
            uthmaniText: v.uthmaniText,
          };
          queryClient.setQueryData<CollectionDetail>(['collection', id], {
            ...previous,
            verses: [...(previous.verses || []), optimisticVerse as any],
          });
        }
      }
      return { previous };
    },
    mutationFn: async (quranVerseId: number) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const v = await getFullVerseById(quranVerseId);
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current && v) {
        const newVerse = {
          id: `temp-v-${crypto.randomUUID()}`,
          collectionId: id,
          quranVerseId: v.id,
          displayOrder: (current.verses?.length || 0) + 1,
          addedAt: new Date().toISOString(),
          surahId: v.surahId,
          surahNumber: v.surahNumber,
          surahNameArabic: v.surahNameArabic,
          surahNameEnglish: v.surahNameEnglish,
          ayahNumber: v.ayahNumber,
          uthmaniText: v.uthmaniText,
        };
        current.verses = [...(current.verses || []), newVerse as any];
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'ADD_VERSE',
          entityId: id,
          payload: { quranVerseId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تمت إضافة الآية محلياً — في انتظار المزامنة.', 'Verse added locally — pending sync.'));
      } else {
        toast.success(t('تمت إضافة الآية إلى المجموعة.', 'Verse added to collection.'));
      }
      setIsAddVerseModalOpen(false);
      setVerseSearchQuery('');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const removeVerseMutation = useMutation({
    networkMode: 'always',
    onMutate: async (quranVerseId: number) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          verses: (previous.verses || []).filter(v => v.quranVerseId !== quranVerseId),
        });
      }
      return { previous };
    },
    mutationFn: async (quranVerseId: number) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        current.verses = (current.verses || []).filter(v => v.quranVerseId !== quranVerseId);
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'REMOVE_VERSE',
          entityId: id,
          payload: { verseId: quranVerseId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حذف الآية محلياً — في انتظار المزامنة.', 'Verse removed locally — pending sync.'));
      } else {
        toast.success(t('تم حذف الآية من المجموعة.', 'Verse removed.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const updateVerseNoteMutation = useMutation({
    networkMode: 'always',
    onMutate: async ({ quranVerseId, note }: { quranVerseId: number; note: string }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          verses: (previous.verses || []).map(v => (v.quranVerseId === quranVerseId ? { ...v, personalNote: note } : v)),
        });
      }
      return { previous };
    },
    mutationFn: async ({ quranVerseId, note }: { quranVerseId: number; note: string }) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const target = (current.verses || []).find(v => v.quranVerseId === quranVerseId);
        if (target) {
          target.personalNote = note;
        }
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'SAVE_NOTE',
          entityId: id,
          payload: { quranVerseId, note },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حفظ الملاحظة محلياً — في انتظار المزامنة.', 'Note saved locally — pending sync.'));
      } else {
        toast.success(t('تم حفظ الملاحظة.', 'Note saved.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const reorderVersesMutation = useMutation({
    networkMode: 'always',
    onMutate: async (orderedVerseIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const map = new Map((previous.verses || []).map(v => [v.id, v]));
        const newVerses: any[] = [];
        orderedVerseIds.forEach((vid, idx) => {
          const v = map.get(vid);
          if (v) {
            newVerses.push({ ...v, displayOrder: idx });
          }
        });
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          verses: newVerses,
        });
      }
      return { previous };
    },
    mutationFn: async (orderedVerseIds: string[]) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const map = new Map((current.verses || []).map(v => [v.id, v]));
        const newVerses: any[] = [];
        orderedVerseIds.forEach((vid, idx) => {
          const v = map.get(vid);
          if (v) {
            v.displayOrder = idx;
            newVerses.push(v);
          }
        });
        current.verses = newVerses;
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'REORDER_VERSES',
          entityId: id,
          payload: { orderedVerseIds },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حفظ الترتيب محلياً — في انتظار المزامنة.', 'Order saved locally — pending sync.'));
      } else {
        toast.success(t('تم حفظ ترتيب الآيات.', 'Verse order saved.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  // Comparison mutations
  const createComparisonMutation = useMutation({
    networkMode: 'always',
    onMutate: async (payload: { title: string; description?: string; sharedPhrases?: string; quranVerseIds: number[]; anchorQuranVerseId?: number }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const allFullVerses = await getFullVersesByIds(payload.quranVerseIds);
        const tempId = `temp-comp-${crypto.randomUUID()}`;
        const matchedVerses = allFullVerses.map((v: any) => ({
          id: crypto.randomUUID(),
          comparisonId: tempId,
          quranVerseId: v.id,
          surahNumber: v.surahNumber,
          surahNameArabic: v.surahNameArabic,
          ayahNumber: v.ayahNumber,
          uthmaniText: v.uthmaniText,
        }));
        const optimisticComp: any = {
          id: tempId,
          collectionId: id,
          title: payload.title,
          description: payload.description,
          sharedPhrases: payload.sharedPhrases,
          anchorQuranVerseId: payload.anchorQuranVerseId,
          verses: matchedVerses,
          differences: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          comparisons: [...(previous.comparisons || []), optimisticComp],
        });
      }
      return { previous };
    },
    mutationFn: async (payload: { title: string; description?: string; sharedPhrases?: string; quranVerseIds: number[]; anchorQuranVerseId?: number }) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const tempId = crypto.randomUUID();
        const allFullVerses = await getFullVersesByIds(payload.quranVerseIds);
        let currentOrder = (current.verses || []).length;
        const existingVerseIds = new Set((current.verses || []).map(v => v.quranVerseId));

        for (const fv of allFullVerses) {
          if (!existingVerseIds.has(fv.id)) {
            current.verses.push({
              id: `temp-v-${crypto.randomUUID()}`,
              collectionId: id,
              quranVerseId: fv.id,
              displayOrder: ++currentOrder,
              addedAt: new Date().toISOString(),
              surahId: fv.surahId,
              surahNumber: fv.surahNumber || fv.surahId,
              surahNameArabic: fv.surahNameArabic,
              surahNameEnglish: fv.surahNameEnglish,
              ayahNumber: fv.ayahNumber,
              uthmaniText: fv.uthmaniText,
            });
            existingVerseIds.add(fv.id);
          }
        }

        const matchedVerses = allFullVerses.map((v: any) => ({
          id: crypto.randomUUID(),
          comparisonId: tempId,
          quranVerseId: v.id,
          surahNumber: v.surahNumber,
          surahNameArabic: v.surahNameArabic,
          ayahNumber: v.ayahNumber,
          uthmaniText: v.uthmaniText,
        }));

        const newComp: any = {
          id: tempId,
          collectionId: id,
          title: payload.title,
          description: payload.description,
          sharedPhrases: payload.sharedPhrases,
          anchorQuranVerseId: payload.anchorQuranVerseId,
          verses: matchedVerses,
          differences: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        current.comparisons = [...(current.comparisons || []), newComp];
        await setCachedCollectionDetail(user.id, current);

        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'CREATE_COMPARISON',
          entityId: id,
          payload: { tempId, body: payload },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حفظ الموضع محلياً — في انتظار المزامنة.', 'Position saved locally — pending sync.'));
      } else {
        toast.success(t('تمت إضافة الموضع المتشابه بنجاح.', 'Position cluster added successfully.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const deleteComparisonMutation = useMutation({
    networkMode: 'always',
    onMutate: async (comparisonId: string) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const optimistic = {
          ...previous,
          comparisons: (previous.comparisons || []).filter(c => c.id !== comparisonId),
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async (comparisonId: string) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        current.comparisons = (current.comparisons || []).filter(c => c.id !== comparisonId);
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'DELETE_COMPARISON',
          entityId: id,
          payload: { comparisonId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حذف المقارنة محلياً — في انتظار المزامنة.', 'Comparison deleted locally — pending sync.'));
      } else {
        toast.success(t('تم حذف المقارنة.', 'Comparison deleted.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const addDifferenceMutation = useMutation({
    networkMode: 'always',
    onMutate: async ({ comparisonId, payload }: { comparisonId: string; payload: { quranVerseId: number; selectedText: string; explanation: string } }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const matchedVerse = (previous.verses || []).find(v => v.quranVerseId === payload.quranVerseId);
        const tempDiff: VerseDifference = {
          id: `temp-diff-${crypto.randomUUID()}`,
          comparisonId,
          quranVerseId: payload.quranVerseId,
          selectedText: payload.selectedText,
          explanation: payload.explanation,
          surahNumber: matchedVerse?.surahNumber || 1,
          surahNameArabic: matchedVerse?.surahNameArabic || '',
          ayahNumber: matchedVerse?.ayahNumber || 1,
        };
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          comparisons: (previous.comparisons || []).map(c => c.id === comparisonId ? {
            ...c,
            differences: [...(c.differences || []), tempDiff],
          } : c),
        });
      }
      return { previous };
    },
    mutationFn: async ({ comparisonId, payload }: { comparisonId: string; payload: { quranVerseId: number; selectedText: string; explanation: string } }) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const comp = (current.comparisons || []).find(c => c.id === comparisonId);
        if (comp) {
          const diffId = crypto.randomUUID();
          const matchedVerse = (current.verses || []).find(v => v.quranVerseId === payload.quranVerseId);
          const newDiff: VerseDifference = {
            id: diffId,
            comparisonId,
            quranVerseId: payload.quranVerseId,
            selectedText: payload.selectedText,
            explanation: payload.explanation,
            surahNumber: matchedVerse?.surahNumber || 1,
            surahNameArabic: matchedVerse?.surahNameArabic || '',
            ayahNumber: matchedVerse?.ayahNumber || 1,
          };
          comp.differences = [...(comp.differences || []), newDiff];
          await setCachedCollectionDetail(user.id, current);
        }
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'ADD_DIFFERENCE',
          entityId: id,
          payload: { comparisonId, diffPayload: payload },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تمت إضافة الفارق محلياً — في انتظار المزامنة.', 'Difference added locally — pending sync.'));
      } else {
        toast.success(t('تم رصد الفارق وإضافته بنجاح.', 'Difference added.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  const deleteDifferenceMutation = useMutation({
    networkMode: 'always',
    onMutate: async (differenceId: string) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        queryClient.setQueryData<CollectionDetail>(['collection', id], {
          ...previous,
          comparisons: (previous.comparisons || []).map(c => ({
            ...c,
            differences: (c.differences || []).filter(d => d.id !== differenceId),
          })),
        });
      }
      return { previous };
    },
    mutationFn: async (differenceId: string) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        (current.comparisons || []).forEach(c => {
          c.differences = (c.differences || []).filter(d => d.id !== differenceId);
        });
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'DELETE_DIFFERENCE',
          entityId: id,
          payload: { differenceId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data: any) => {
      if (data?.isOffline) {
        toast.info(t('تم حذف الفارق محلياً — في انتظار المزامنة.', 'Difference deleted locally — pending sync.'));
      } else {
        toast.success(t('تم حذف الفارق.', 'Difference removed.'));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
    },
  });

  // Memorization Connection mutations
  const createConnectionMutation = useMutation({
    networkMode: 'always',
    onMutate: async (payload: { title?: string; content: string; type: ConnectionType; displayOrder?: number }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous && id) {
        const tempId = crypto.randomUUID();
        const newConn = {
          id: tempId,
          collectionId: id,
          title: payload.title,
          content: payload.content,
          type: payload.type,
          displayOrder: payload.displayOrder || (previous.connections || []).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const optimistic = {
          ...previous,
          connections: [...(previous.connections || []), newConn as any],
        };
        queryClient.setQueryData(['collection', id], optimistic);
        return { previous, tempId };
      }
      return { previous };
    },
    mutationFn: async (payload: { title?: string; content: string; type: ConnectionType; displayOrder?: number }, context?: any) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const tempId = context?.tempId || crypto.randomUUID();
        const newConn = {
          id: tempId,
          collectionId: id,
          title: payload.title,
          content: payload.content,
          type: payload.type,
          displayOrder: payload.displayOrder || (current.connections || []).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        current.connections = [...(current.connections || []).filter(c => c.id !== tempId), newConn as any];
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'CREATE_CONNECTION',
          entityId: id,
          payload: { tempId, body: payload },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم حفظ رابط الحفظ محلياً — في انتظار المزامنة.', 'Connection saved locally — pending sync.'));
      } else {
        toast.success(t('تم حفظ رابط الحفظ بنجاح.', 'Connection added.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateConnectionMutation = useMutation({
    networkMode: 'always',
    onMutate: async ({ connectionId, payload }: { connectionId: string; payload: { title?: string; content: string; type: ConnectionType } }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const optimistic = {
          ...previous,
          connections: (previous.connections || []).map(c =>
            c.id === connectionId
              ? { ...c, title: payload.title, content: payload.content, type: payload.type, updatedAt: new Date().toISOString() }
              : c
          ),
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async ({ connectionId, payload }: { connectionId: string; payload: { title?: string; content: string; type: ConnectionType } }) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const conn = (current.connections || []).find(c => c.id === connectionId);
        if (conn) {
          conn.title = payload.title;
          conn.content = payload.content;
          conn.type = payload.type;
          conn.updatedAt = new Date().toISOString();
        }
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'UPDATE_CONNECTION',
          entityId: id,
          payload: { connectionId, body: payload },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم تحديث الرابط محلياً — في انتظار المزامنة.', 'Connection updated locally — pending sync.'));
      } else {
        toast.success(t('تم تحديث الرابط.', 'Connection updated.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteConnectionMutation = useMutation({
    networkMode: 'always',
    onMutate: async (connectionId: string) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const optimistic = {
          ...previous,
          connections: (previous.connections || []).filter(c => c.id !== connectionId),
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async (connectionId: string) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        current.connections = (current.connections || []).filter(c => c.id !== connectionId);
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'DELETE_CONNECTION',
          entityId: id,
          payload: { connectionId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم حذف الرابط محلياً — في انتظار المزامنة.', 'Connection deleted locally — pending sync.'));
      } else {
        toast.success(t('تم حذف الرابط.', 'Connection deleted.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });
  const reorderConnectionsMutation = useMutation({
    networkMode: 'always',
    onMutate: async (orderedConnectionIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const map = new Map((previous.connections || []).map(c => [c.id, c]));
        const newConns: any[] = [];
        orderedConnectionIds.forEach((cid, idx) => {
          const c = map.get(cid);
          if (c) {
            newConns.push({ ...c, displayOrder: idx });
          }
        });
        const optimistic = {
          ...previous,
          connections: newConns,
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async (orderedConnectionIds: string[]) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const map = new Map((current.connections || []).map(c => [c.id, c]));
        const newConns: any[] = [];
        orderedConnectionIds.forEach((cid, idx) => {
          const c = map.get(cid);
          if (c) {
            c.displayOrder = idx;
            newConns.push(c);
          }
        });
        current.connections = newConns;
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'REORDER_CONNECTIONS',
          entityId: id,
          payload: { orderedConnectionIds },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم حفظ الترتيب محلياً — في انتظار المزامنة.', 'Order saved locally — pending sync.'));
      } else {
        toast.success(t('تم حفظ الترتيب.', 'Order saved.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  // Notes mutations
  const createNoteMutation = useMutation({
    networkMode: 'always',
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous && id) {
        const tempId = crypto.randomUUID();
        const newNote = {
          id: tempId,
          collectionId: id,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const optimistic = {
          ...previous,
          notes: [...(previous.notes || []), newNote as any],
        };
        queryClient.setQueryData(['collection', id], optimistic);
        return { previous, tempId };
      }
      return { previous };
    },
    mutationFn: async (content: string, context?: any) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const tempId = context?.tempId || crypto.randomUUID();
        const newNote = {
          id: tempId,
          collectionId: id,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        current.notes = [...(current.notes || []).filter(n => n.id !== tempId), newNote as any];
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'CREATE_NOTE',
          entityId: id,
          payload: { tempId, body: { content } },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم حفظ الملاحظة محلياً — في انتظار المزامنة.', 'Note saved locally — pending sync.'));
      } else {
        toast.success(t('تمت إضافة الملاحظة العامة.', 'Note added.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateNoteMutation = useMutation({
    networkMode: 'always',
    onMutate: async ({ noteId, content }: { noteId: string; content: string }) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const optimistic = {
          ...previous,
          notes: (previous.notes || []).map(n =>
            n.id === noteId ? { ...n, content, updatedAt: new Date().toISOString() } : n
          ),
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        const note = (current.notes || []).find(n => n.id === noteId);
        if (note) {
          note.content = content;
          note.updatedAt = new Date().toISOString();
        }
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'UPDATE_NOTE',
          entityId: id,
          payload: { noteId, body: { content } },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم تعديل الملاحظة محلياً — في انتظار المزامنة.', 'Note updated locally — pending sync.'));
      } else {
        toast.success(t('تم تعديل الملاحظة.', 'Note updated.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteNoteMutation = useMutation({
    networkMode: 'always',
    onMutate: async (noteId: string) => {
      await queryClient.cancelQueries({ queryKey: ['collection', id] });
      const previous = queryClient.getQueryData<CollectionDetail>(['collection', id]);
      if (previous) {
        const optimistic = {
          ...previous,
          notes: (previous.notes || []).filter(n => n.id !== noteId),
        };
        queryClient.setQueryData(['collection', id], optimistic);
      }
      return { previous };
    },
    mutationFn: async (noteId: string) => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
      if (current) {
        current.notes = (current.notes || []).filter(n => n.id !== noteId);
        await setCachedCollectionDetail(user.id, current);
        await enqueueOutboxOperation({
          id: crypto.randomUUID(),
          userId: user.id,
          type: 'DELETE_NOTE',
          entityId: id,
          payload: { noteId },
          timestamp: Date.now(),
          status: 'PENDING',
        });
      }
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['collection', id] });
      if (data?.isOffline) {
        toast.info(t('تم حذف الملاحظة محلياً — في انتظار المزامنة.', 'Note deleted locally — pending sync.'));
      } else {
        toast.success(t('تم حذف الملاحظة.', 'Note deleted.'));
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['collection', id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
  });

  // Delete Collection
  const deleteCollectionMutation = useMutation({
    networkMode: 'always',
    mutationFn: async () => {
      if (!id || !user) return;
      const online = connectivity.isOnline();
      const db = await getUserDB();
      await db.delete('collections', id);
      await db.delete('collectionDetails', id);
      await enqueueOutboxOperation({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'DELETE_COLLECTION',
        entityId: id,
        payload: {},
        timestamp: Date.now(),
        status: 'PENDING',
      });
      if (online) {
        outboxSyncManager.scheduleIdleSync(user.id);
      }
      return { isOffline: !online };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast.success(t('تم حذف المجموعة بالكامل.', 'Collection deleted.'));
      navigate('/library');
    },
    onError: () => toast.error(t('تعذر حذف المجموعة.', 'Failed to delete collection.')),
  });

  // Check if any mutation is actively saving
  const isAnySaving =
    addVerseMutation.isPending ||
    removeVerseMutation.isPending ||
    updateVerseNoteMutation.isPending ||
    reorderVersesMutation.isPending ||
    createComparisonMutation.isPending ||
    deleteComparisonMutation.isPending ||
    addDifferenceMutation.isPending ||
    deleteDifferenceMutation.isPending ||
    createConnectionMutation.isPending ||
    updateConnectionMutation.isPending ||
    deleteConnectionMutation.isPending ||
    reorderConnectionsMutation.isPending ||
    createNoteMutation.isPending ||
    updateNoteMutation.isPending ||
    deleteNoteMutation.isPending;

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 text-start">
        <Skeleton className="h-10 w-48" />
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </Card>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="text-center py-16 space-y-4 text-start">
        <h2 className="text-xl font-bold text-text-primary text-center">
          {t('تعذر تحميل بيانات المجموعة', 'Failed to load collection')}
        </h2>
        <p className="text-sm text-text-secondary text-center">
          {t('قد تكون المجموعة قد حُذفت أو أنك لا تملك صلاحية الوصول إليها.', 'Collection may not exist or is private.')}
        </p>
        <div className="text-center">
          <Button variant="primary" onClick={() => navigate('/library')}>
            {t('العودة للمكتبة', 'Return to Library')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-3.5 pb-28 md:pb-16 text-start animate-fade-in">
      <Seo
        title={collection?.title ? `${collection.title} | تفاصيل المجموعة` : 'تفاصيل المجموعة'}
        robots="noindex, nofollow"
      />
      {/* Header Info Card */}
      <Card className="p-3 md:p-5 space-y-2.5 md:space-y-3 shadow-none md:shadow-card">
        {/* Desktop Layout (>= md) */}
        <div className="hidden md:flex items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1 text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/library')}
                className="p-1.5 text-text-secondary hover:text-text-primary -ms-1.5"
                title={t('رجوع للمكتبة', 'Back')}
                aria-label={t('رجوع للمكتبة', 'Back')}
              >
                {isRtl ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </Button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary tracking-tight leading-snug">
                {collection.title}
              </h1>
              {collection.baseSurahNameArabic ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-tint text-primary border border-primary/30">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  {t('سورة الأساس:', 'Anchor Surah:')} سورة {collection.baseSurahNameArabic}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-charcoal-100 text-text-secondary">
                  {t('مجموعة موضوعية / حرة', 'Thematic Collection')}
                </span>
              )}
            </div>

            {collection.description && (
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed ps-7">
                {collection.description}
              </p>
            )}
          </div>

          {/* Desktop Actions & Saving Status */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'comparisons' && (
              <Button
                size="sm"
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateComparisonOpen(true)}
                className="font-bold shadow-sm text-xs sm:text-sm whitespace-nowrap"
              >
                {collection.baseSurahNameArabic
                  ? t(`+ إضافة موضع في سورة ${collection.baseSurahNameArabic}`, `+ Add Position in Surah`)
                  : t('+ إضافة موضع جديد', '+ Add Position')}
              </Button>
            )}

            {id?.startsWith('temp-') && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {t('محفوظ محلياً', 'Saved locally')}
              </span>
            )}
            {/* Live Save Status Indicator */}
            <div className="text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium bg-surface">
              {isAnySaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  <span className="text-accent text-[11px]">{t('جارٍ الحفظ...', 'Saving...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span className="text-text-secondary text-[11px]">{t('محفوظ', 'Saved')}</span>
                </>
              )}
            </div>

            <Link to={`/collections/${collection.id}/edit`}>
              <Button size="sm" variant="outline" icon={<Edit3 className="w-4 h-4" />}>
                {t('تعديل', 'Edit')}
              </Button>
            </Link>

            {/* Export PDF */}
            <Button
              size="sm"
              variant="outline"
              icon={<FileDown className="w-4 h-4 text-primary" />}
              onClick={() => {
                setExportComparisonId(undefined);
                setIsExportPdfOpen(true);
              }}
              title={t('تصدير المجموعة كملف PDF', 'Export collection as PDF')}
            >
              {t('تصدير PDF', 'Export PDF')}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-danger hover:bg-danger-subtle hover:text-danger min-h-[38px] p-2"
              title={t('حذف المجموعة', 'Delete Collection')}
              aria-label={t('حذف المجموعة', 'Delete Collection')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Layout (< md): Ultra-compact & space-efficient */}
        <div className="flex md:hidden flex-col gap-1.5">
          {/* Mobile Row 1: Back + Title + Base Surah + Single (⋯) Menu */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => navigate('/library')}
                className="p-1 -ms-1 text-text-secondary hover:text-text-primary shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={t('رجوع للمكتبة', 'Back')}
                aria-label={t('رجوع للمكتبة', 'Back')}
              >
                {isRtl ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
              </button>
              <h1
                className="text-base font-bold text-text-primary truncate"
                title={collection.title}
                aria-label={collection.title}
              >
                {collection.title}
              </h1>
              {collection.baseSurahNameArabic && (
                <span className="shrink-0 text-[10px] font-semibold text-primary bg-primary-tint px-1.5 py-0.5 rounded border border-primary/20">
                  سورة {collection.baseSurahNameArabic}
                </span>
              )}
            </div>

            {/* Single (⋯) More Menu button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary rounded-lg hover:bg-background transition"
                title={t('خيارات المجموعة', 'Collection Options')}
                aria-label={t('خيارات المجموعة', 'Collection Options')}
                aria-expanded={isMobileMenuOpen}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMobileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setIsMobileMenuOpen(false)}
                  />
                  <div className="absolute end-0 top-full mt-1 w-44 bg-surface rounded-xl border border-border shadow-lg py-1 z-40 text-xs animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setExportComparisonId(undefined);
                        setIsExportPdfOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-text-primary hover:bg-background transition min-h-[44px] text-start"
                    >
                      <FileDown className="w-4 h-4 text-primary" />
                      <span>{t('تصدير PDF', 'Export PDF')}</span>
                    </button>

                    <Link
                      to={`/collections/${collection.id}/edit`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-text-primary hover:bg-background transition min-h-[44px] text-start"
                    >
                      <Edit3 className="w-4 h-4 text-text-secondary" />
                      <span>{t('تعديل المجموعة', 'Edit Collection')}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-danger hover:bg-danger-subtle transition min-h-[44px] text-start"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('حذف المجموعة', 'Delete Collection')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Row 2: Description (expandable, omitted if repeats title) */}
          {collection.description &&
            collection.description.trim() !== collection.title.trim() && (
              <p
                onClick={() => setIsMobileDescExpanded(!isMobileDescExpanded)}
                className={cn(
                  'text-xs text-text-secondary cursor-pointer leading-tight ps-8 select-none',
                  !isMobileDescExpanded && 'line-clamp-1'
                )}
                title={t('انقر لعرض الوصف كاملاً', 'Click to toggle full description')}
              >
                {collection.description}
              </p>
            )}

          {/* Mobile Row 3: ONE muted inline stats line + tiny save status */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 ps-8 text-xs text-text-secondary">
            <span className="text-[11px] font-medium text-text-secondary">
              {isRtl ? toArabicDigits(collection.comparisons.length) : collection.comparisons.length}{' '}
              {t('مواضع', 'positions')} ·{' '}
              {isRtl ? toArabicDigits(collection.connections.length) : collection.connections.length}{' '}
              {t('روابط', 'links')} ·{' '}
              {isRtl ? toArabicDigits(collection.notes.length) : collection.notes.length}{' '}
              {t('ملاحظات', 'notes')}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {isAnySaving ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                  <Loader2 className="w-3 h-3 text-accent animate-spin" />
                  <span className="text-[10px]">{t('جارٍ الحفظ...', 'Saving...')}</span>
                </span>
              ) : id?.startsWith('temp-') ? (
                <span
                  className="inline-flex items-center gap-1 text-[11px] text-amber-600"
                  title={t('محفوظ محلياً', 'Saved locally')}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-[10px]">{t('محفوظ محلياً', 'Saved locally')}</span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center text-success"
                  title={t('محفوظ', 'Saved')}
                  aria-label={t('محفوظ', 'Saved')}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Metadata Footer (>= md) */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border text-xs text-text-secondary">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="primary">
              <GitCompare className="w-3.5 h-3.5 me-1" />
              <span>{isRtl ? toArabicDigits(collection.comparisons.length) : collection.comparisons.length} {t('مواضع متشابهة', 'Positions')}</span>
            </Badge>

            <Badge variant="blue">
              <Sparkles className="w-3.5 h-3.5 me-1" />
              <span>{isRtl ? toArabicDigits(collection.connections.length) : collection.connections.length} {t('روابط حفظ', 'Links')}</span>
            </Badge>

            <Badge variant="accent">
              <FileText className="w-3.5 h-3.5 me-1" />
              <span>{isRtl ? toArabicDigits(collection.notes.length) : collection.notes.length} {t('ملاحظات', 'Notes')}</span>
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('آخر تحديث:', 'Last updated:')} {formatRelativeTime(collection.updatedAt)}</span>
          </div>
        </div>
      </Card>

      {/* Mobile Sticky Tab Bar (md:hidden): h-10 with plain muted counts */}
      <div className="md:hidden sticky top-14 z-20 bg-background/95 backdrop-blur-md py-1.5 -mx-4 px-4 border-b border-border">
        <div className="h-10 flex items-center gap-1 bg-surface p-1 rounded-xl border border-border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('comparisons')}
            className={cn(
              'flex-1 h-8 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition',
              activeTab === 'comparisons'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{t('المواضع', 'Positions')} ({isRtl ? toArabicDigits(collection.comparisons.length) : collection.comparisons.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={cn(
              'flex-1 h-8 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition',
              activeTab === 'connections'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('الروابط', 'Links')} ({isRtl ? toArabicDigits(collection.connections.length) : collection.connections.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={cn(
              'flex-1 h-8 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition',
              activeTab === 'notes'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('ملاحظات', 'Notes')} ({isRtl ? toArabicDigits(collection.notes.length) : collection.notes.length})</span>
          </button>
        </div>
      </div>

      {/* Desktop Tabs Navigation (>= md): 3 Focused Pillars */}
      <div className="hidden md:flex items-center gap-1 sm:gap-2 border-b border-border overflow-x-auto pb-px no-scrollbar [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <button
          onClick={() => setActiveTab('comparisons')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap min-h-[38px] sm:min-h-[44px] ${
            activeTab === 'comparisons'
              ? 'border-primary text-primary bg-primary-tint/30 rounded-t-lg'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{t('مواضع المتشابهات', 'Similar Positions')}</span>
          <span className="hidden md:inline text-[11px] opacity-80">
            {t('(المجموعات الفرعية)', '(Subgroups)')}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-charcoal-100 text-[10px] sm:text-xs font-bold text-text-primary">
            {isRtl ? toArabicDigits(collection.comparisons.length) : collection.comparisons.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('connections')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap min-h-[38px] sm:min-h-[44px] ${
            activeTab === 'connections'
              ? 'border-primary text-primary bg-primary-tint/30 rounded-t-lg'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{t('روابط وتقنيات الحفظ', 'Memorization Links')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-charcoal-100 text-[10px] sm:text-xs font-bold text-text-primary">
            {isRtl ? toArabicDigits(collection.connections.length) : collection.connections.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap min-h-[38px] sm:min-h-[44px] ${
            activeTab === 'notes'
              ? 'border-primary text-primary bg-primary-tint/30 rounded-t-lg'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{t('ملاحظات عامة', 'General Notes')}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-charcoal-100 text-[10px] sm:text-xs font-bold text-text-primary">
            {isRtl ? toArabicDigits(collection.notes.length) : collection.notes.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Dedicated Similarities & Differences Clusters (Primary View) */}
      {activeTab === 'comparisons' && (
        <ComparisonEditor
          collectionId={collection.id}
          baseSurahId={collection.baseSurahId}
          baseSurahNameArabic={collection.baseSurahNameArabic}
          verses={collection.verses}
          comparisons={collection.comparisons}
          onCreateComparison={payload => createComparisonMutation.mutateAsync(payload)}
          onDeleteComparison={cmpId => deleteComparisonMutation.mutateAsync(cmpId)}
          onAddDifference={(cmpId, payload) => addDifferenceMutation.mutateAsync({ comparisonId: cmpId, payload })}
          onDeleteDifference={diffId => deleteDifferenceMutation.mutateAsync(diffId)}
          onExportComparison={cmpId => {
            setExportComparisonId(cmpId);
            setIsExportPdfOpen(true);
          }}
          isCreateModalOpen={isCreateComparisonOpen}
          onCloseCreateModal={() => setIsCreateComparisonOpen(false)}
        />
      )}

      {/* Tab 2: Memorization Connections */}
      {activeTab === 'connections' && (
        <MemorizationConnectionsEditor
          collectionId={collection.id}
          connections={collection.connections}
          onCreateConnection={payload => createConnectionMutation.mutateAsync(payload)}
          onUpdateConnection={(connId, payload) => updateConnectionMutation.mutateAsync({ connectionId: connId, payload })}
          onDeleteConnection={connId => deleteConnectionMutation.mutateAsync(connId)}
          onReorderConnections={ids => reorderConnectionsMutation.mutateAsync(ids)}
        />
      )}

      {/* Tab 4: General Personal Notes */}
      {activeTab === 'notes' && (
        <PersonalNotesEditor
          collectionId={collection.id}
          notes={collection.notes}
          onCreateNote={content => createNoteMutation.mutateAsync(content)}
          onUpdateNote={(noteId, content) => updateNoteMutation.mutateAsync({ noteId, content })}
          onDeleteNote={noteId => deleteNoteMutation.mutateAsync(noteId)}
        />
      )}

      {/* Modal: Add Verse Quick Search */}
      <Modal
        isOpen={isAddVerseModalOpen}
        onClose={() => setIsAddVerseModalOpen(false)}
        title={t('البحث عن آية لإضافتها', 'Search Verse to Add')}
        maxWidth="lg"
      >
        <div className="space-y-4 text-start">
          <div className="relative">
            <Search className="absolute inset-y-0 start-3.5 my-auto w-4 h-4 text-text-secondary/70 pointer-events-none" />
            <input
              type="text"
              value={verseSearchQuery}
              onChange={e => setVerseSearchQuery(e.target.value)}
              placeholder={t('اكتب كلمة أو آية للبحث...', 'Search words in Quran...')}
              className="w-full h-11 ps-10 pe-4 text-sm bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 text-start"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-xs text-text-secondary">
                {t('جارٍ البحث في المصحف...', 'Searching...')}
              </div>
            ) : searchVerses && searchVerses.length > 0 ? (
              searchVerses.map(v => {
                const alreadyExists = collection.verses.some(cv => cv.quranVerseId === v.id);
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
                        className="font-quran-compact text-text-primary truncate"
                      >
                        {v.uthmaniText}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant={alreadyExists ? 'secondary' : 'primary'}
                      disabled={alreadyExists}
                      onClick={() => addVerseMutation.mutate(v.id)}
                      icon={alreadyExists ? undefined : <Plus className="w-3.5 h-3.5" />}
                    >
                      {alreadyExists ? t('مضافة', 'Added') : t('إضافة', 'Add')}
                    </Button>
                  </div>
                );
              })
            ) : verseSearchQuery.trim().length > 1 ? (
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

      {/* Floating Action Button (FAB) on Mobile: + إضافة موضع */}
      {activeTab === 'comparisons' && (
        <button
          type="button"
          onClick={() => setIsCreateComparisonOpen(true)}
          className="fixed bottom-20 end-4 z-20 w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary-hover active:scale-95 transition min-w-[48px] min-h-[48px] md:hidden"
          title={t('+ إضافة موضع', '+ Add Position')}
          aria-label={t('إضافة موضع تشابه جديد', 'Add new position')}
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Delete Collection Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteCollectionMutation.mutate()}
        title={t('حذف مجموعة المتشابهات', 'Delete Similarity Collection')}
        message={t(
          `هل أنت متأكد من حذف المجموعة "${collection.title}"؟ سيتم حذف جميع المقارنات والروابط المرتبطة بها نهائياً.`,
          `Are you sure you want to permanently delete "${collection.title}"?`
        )}
        confirmText={t('نعم، احذف المجموعة', 'Yes, Delete')}
        cancelText={t('إلغاء', 'Cancel')}
        isLoading={deleteCollectionMutation.isPending}
      />
      {/* Export to PDF Modal (Lazy-Loaded) */}
      {collection && isExportPdfOpen && (
        <React.Suspense fallback={null}>
          <ExportPdfModal
            isOpen={isExportPdfOpen}
            onClose={() => {
              setIsExportPdfOpen(false);
              setExportComparisonId(undefined);
            }}
            collectionId={collection.id}
            collectionTitle={collection.title}
            collection={collection}
            initialSelectedComparisonId={exportComparisonId}
            hasUnsavedChanges={isAnySaving}
          />
        </React.Suspense>
      )}
    </div>
  );
};
