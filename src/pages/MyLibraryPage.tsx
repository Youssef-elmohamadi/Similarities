import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CollectionSummary } from '@/types/collection';
import { CollectionCard } from '@/components/collection/CollectionCard';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { CollectionCardSkeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  getCachedUserCollections,
  setCachedUserCollections,
  enqueueOutboxOperation,
  getUserDB,
} from '@/offline/userDataDb';
import { outboxSyncManager } from '@/offline/outboxSyncManager';
import { Search, PlusCircle, ArrowUpDown, BookmarkCheck } from 'lucide-react';

export const MyLibraryPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('updated');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // Auto sync on mount if online
  React.useEffect(() => {
    if (user && navigator.onLine) {
      outboxSyncManager.sync(user.id).then(({ synced }) => {
        if (synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['collections'] });
        }
      });
    }
  }, [user]);

  const { data: collections, isLoading } = useQuery<CollectionSummary[]>({
    queryKey: ['collections', search, sortBy, user?.id],
    queryFn: async () => {
      const filterAndSortLocal = (list: any[]) => {
        let filtered = list;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          filtered = filtered.filter(
            c => (c.title && c.title.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q))
          );
        }
        if (sortBy === 'title') {
          filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortBy === 'created') {
          filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else {
          filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        }
        return filtered;
      };

      if (!navigator.onLine) {
        if (!user) return [];
        const cached = await getCachedUserCollections(user.id);
        return filterAndSortLocal(cached);
      }

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.append('search', search.trim());
        if (sortBy) params.append('sortBy', sortBy);

        const res = await api.get<CollectionSummary[]>(`/collections?${params.toString()}`);
        if (user) {
          // Keep offline pending creations merged, and filter out tombstones
          const { getTombstonedEntityIds } = await import('@/offline/userDataDb');
          const tombstones = await getTombstonedEntityIds(user.id);
          const filteredServer = (res.data || []).filter(c => !tombstones.has(c.id));

          const localColls = await getCachedUserCollections(user.id);
          const pendingTemps = localColls.filter(c => c.id.startsWith('temp-') && !tombstones.has(c.id));
          await setCachedUserCollections(user.id, [...pendingTemps, ...filteredServer]);
          return filterAndSortLocal([...pendingTemps, ...filteredServer]);
        }
        return res.data;
      } catch (err) {
        if (user) {
          const cached = await getCachedUserCollections(user.id);
          if (cached.length > 0) return filterAndSortLocal(cached);
        }
        throw err;
      }
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!navigator.onLine) {
        if (!user) return;
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
        return { isOffline: true };
      }

      await api.delete(`/collections/${id}`);
      if (user) {
        const db = await getUserDB();
        await db.delete('collections', id);
        await db.delete('collectionDetails', id);
      }
      return { isOffline: false };
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      if (res?.isOffline) {
        toast.info(t('تم حذف المجموعة محلياً — ستتم المزامنة عند الاتصال.', 'Deleted locally — will sync when back online.'));
      } else {
        toast.success(t('تم حذف المجموعة بنجاح.', 'Collection deleted successfully.'));
      }
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error(t('تعذر حذف المجموعة. يرجى المحاولة مرة أخرى.', 'Failed to delete collection.'));
    },
  });

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-start animate-fade-in">
      {/* Header */}
      <PageHeader
        title={t('مكتبتي القرآنية الخاصة', 'My Quranic Library')}
        description={t(
          'استعرض وأدر جميع مجموعات المتشابهات التي وثقتها شخصياً ورتبها حسب رغبتك.',
          'Browse, edit, and expand all your private Quranic similarity collections.'
        )}
        actions={
          <Link to="/collections/new">
            <Button variant="primary" icon={<PlusCircle className="w-4 h-4" />}>
              {t('إنشاء مجموعة جديدة', 'New Collection')}
            </Button>
          </Link>
        }
      />

      {/* Search and Sort Toolbar */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-xl border border-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute inset-y-0 start-3.5 my-auto w-4 h-4 text-text-secondary/70 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('ابحث في عنوان أو وصف المجموعات...', 'Search in collections title or description...')}
            className="w-full h-11 ps-10 pe-4 text-sm bg-background border border-border rounded-lg text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-start"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <ArrowUpDown className="w-4 h-4 text-text-secondary shrink-0" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full sm:w-auto h-11 px-3.5 text-sm bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition cursor-pointer text-start"
          >
            <option value="updated">{t('الأحدث تحديثاً', 'Recently Updated')}</option>
            <option value="created">{t('الأحدث إنشاءً', 'Recently Created')}</option>
            <option value="title">{t('حسب العنوان (أبجدياً)', 'By Title (Alphabetical)')}</option>
          </select>
        </div>
      </div>

      {/* Collections Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      ) : collections && collections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {collections.map(col => (
            <CollectionCard
              key={col.id}
              collection={col}
              onDelete={(id, title) => setDeleteTarget({ id, title })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<BookmarkCheck className="w-8 h-8 text-primary" />}
          title={
            search
              ? t('لا توجد مجموعات تطابق بحثك', 'No collections match your search')
              : t('مكتبتك فارغة حتى الآن', 'Your library is empty')
          }
          description={
            search
              ? t('جرّب البحث بكلمة أخرى أو مسح فلتر البحث.', 'Try different search keywords.')
              : t(
                  'لم تقم بإنشاء أي مجموعة بعد. ابدأ بالبحث في القرآن واختر الآيات لتأسيس أول مجموعة.',
                  'You have not created any collections yet. Search verses to start.'
                )
          }
          action={
            search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                {t('مسح البحث', 'Clear Search')}
              </Button>
            ) : (
              <Link to="/search">
                <Button variant="primary" size="md" icon={<Search className="w-4 h-4" />}>
                  {t('البحث في المصحف وتحديد الآيات', 'Search & Select Verses')}
                </Button>
              </Link>
            )
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t('حذف مجموعة المتشابهات', 'Delete Similarity Collection')}
        message={t(
          `هل أنت متأكد من رغبتك في حذف المجموعة "${deleteTarget?.title}" نهائياً؟ سيتم حذف جميع المقارنات والروابط المرتبطة بها ولا يمكن التراجع.`,
          `Are you sure you want to permanently delete "${deleteTarget?.title}" and all its comparisons?`
        )}
        confirmText={t('نعم، احذف نهائياً', 'Yes, Delete Permanently')}
        cancelText={t('إلغاء', 'Cancel')}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
