import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { CollectionDetail } from '@/types/collection';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { PageHeader } from '@/components/common/PageHeader';
import { Skeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import {
  getCachedCollectionDetail,
  setCachedCollectionDetail,
  getCachedUserCollections,
  setCachedUserCollections,
  enqueueOutboxOperation,
} from '@/offline/userDataDb';
import { ArrowRight, ArrowLeft } from 'lucide-react';

export const EditCollectionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, direction } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const isRtl = direction === 'rtl';

  const { data: collection, isLoading } = useQuery<CollectionDetail>({
    queryKey: ['collection', id, user?.id],
    queryFn: async () => {
      if (!id) throw new Error('Missing ID');
      if (!navigator.onLine) {
        if (!user) throw new Error('Not logged in');
        const cached = await getCachedCollectionDetail(user.id, id);
        if (!cached) throw new Error('Collection not found');
        return cached as unknown as CollectionDetail;
      }
      try {
        const res = await api.get<CollectionDetail>(`/collections/${id}`);
        if (user) {
          await setCachedCollectionDetail(user.id, res.data);
        }
        return res.data;
      } catch (err) {
        if (user) {
          const cached = await getCachedCollectionDetail(user.id, id);
          if (cached) return cached as unknown as CollectionDetail;
        }
        throw err;
      }
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (collection) {
      setTitle(collection.title);
      setDescription(collection.description || '');
    }
  }, [collection]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
      };

      if (!navigator.onLine) {
        if (!user || !id) throw new Error('Not logged in');
        const current = (await getCachedCollectionDetail(user.id, id)) as unknown as CollectionDetail;
        if (current) {
          const baseUpdatedAt = current.updatedAt;
          current.title = payload.title;
          current.description = payload.description;
          current.updatedAt = new Date().toISOString();
          await setCachedCollectionDetail(user.id, current);

          const list = await getCachedUserCollections(user.id);
          const idx = list.findIndex(c => c.id === id);
          if (idx !== -1) {
            list[idx].title = payload.title;
            list[idx].description = payload.description;
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
        return { isOffline: true };
      }

      const res = await api.put(`/collections/${id}`, payload);
      if (user) {
        await setCachedCollectionDetail(user.id, res.data);
      }
      return res.data;
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
    <div className="max-w-2xl mx-auto space-y-6 pb-16 text-start animate-fade-in">
      <PageHeader
        title={t('تعديل بيانات المجموعة', 'Edit Collection')}
        description={t('تحديث عنوان ووصف المجموعة القرآنية', 'Update collection title and description')}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/collections/${id}`)}
            icon={isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          >
            {t('رجوع', 'Back')}
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="flex items-center justify-end gap-3 pt-2">
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
      </form>
    </div>
  );
};
