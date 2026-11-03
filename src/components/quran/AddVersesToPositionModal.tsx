import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getApiErrorMessage } from '@/lib/api';
import { QuranVerse } from '@/types/quran';
import { CollectionSummary } from '@/types/collection';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea, Select } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { useToast } from '@/components/common/Toast';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { toArabicDigits, formatAyahOrnament, cn } from '@/lib/utils';
import {
  Sparkles,
  Check,
  RotateCcw,
  BookOpen,
  FolderPlus,
  PlusCircle,
  Search,
  ExternalLink,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  getCachedUserCollections,
  setCachedUserCollections,
  getCachedCollectionDetail,
  setCachedCollectionDetail,
  enqueueOutboxOperation,
} from '@/offline/userDataDb';
import { getFullVersesByIds, getQuranDB, CompactSurah } from '@/offline/quranDb';

export interface AddVersesToPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVerses: QuranVerse[];
  onSuccess?: (collectionId: string, comparisonId?: string) => void;
}

/**
 * Generate a smart default Arabic title for the similarity position (موضع التشابه)
 */
export function generatePositionTitle(anchorVerse?: QuranVerse, allVerses: QuranVerse[] = []): string {
  if (!anchorVerse && allVerses.length === 0) return '';
  const anchor = anchorVerse || allVerses[0];
  const others = allVerses.filter(v => v.id !== anchor.id);

  if (others.length === 0) {
    return `موضع آية ${anchor.ayahNumber} من سورة ${anchor.surahNameArabic}`;
  }

  if (others.length === 1) {
    const other = others[0];
    if (other.surahId === anchor.surahId) {
      return `موضع آية ${anchor.ayahNumber} مقابل آية ${other.ayahNumber} في سورة ${anchor.surahNameArabic}`;
    }
    return `موضع سورة ${anchor.surahNameArabic} [${anchor.ayahNumber}] مقابل سورة ${other.surahNameArabic} [${other.ayahNumber}]`;
  }

  const otherRefs = others.map(v => `${v.surahNameArabic} [${v.ayahNumber}]`).join(' و');
  return `موضع ${anchor.surahNameArabic} [${anchor.ayahNumber}] مقابل ${otherRefs}`;
}

export const AddVersesToPositionModal: React.FC<AddVersesToPositionModalProps> = ({
  isOpen,
  onClose,
  selectedVerses,
  onSuccess,
}) => {
  const { t, direction } = useLanguage();
  const isRtl = direction === 'rtl';
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');

  // Selected anchor verse
  const [anchorVerseId, setAnchorVerseId] = useState<number | undefined>(undefined);
  const [isAnchorManuallySelected, setIsAnchorManuallySelected] = useState(false);

  // Existing collection tab state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [collectionSearch, setCollectionSearch] = useState('');

  // Position details state
  const [positionTitle, setPositionTitle] = useState('');
  const [isTitleCustom, setIsTitleCustom] = useState(false);
  const [sharedPhrases, setSharedPhrases] = useState('');
  const [description, setDescription] = useState('');

  // New collection tab state
  const [newCollectionType, setNewCollectionType] = useState<'surah' | 'custom'>('surah');
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [newCollectionSurahId, setNewCollectionSurahId] = useState<number>(1);
  const [newCollectionDescription, setNewCollectionDescription] = useState('');

  // Reset or initialize anchor verse whenever selectedVerses change or modal opens
  useEffect(() => {
    if (selectedVerses.length > 0) {
      const defaultAnchor = selectedVerses[0];
      setAnchorVerseId(defaultAnchor.id);
      setIsAnchorManuallySelected(false);
      setNewCollectionSurahId(defaultAnchor.surahId);
      const generated = generatePositionTitle(defaultAnchor, selectedVerses);
      setPositionTitle(generated);
      setIsTitleCustom(false);
      setNewCollectionTitle(`متشابهات سورة ${defaultAnchor.surahNameArabic}`);
    }
  }, [selectedVerses, isOpen]);

  // Load user collections (networkMode: 'always' for offline resilience)
  const { data: collections = [], isLoading: isLoadingCollections } = useQuery<CollectionSummary[]>({
    queryKey: ['userCollectionsModal', user?.id],
    networkMode: 'always',
    enabled: isOpen && !!user,
    queryFn: async (): Promise<CollectionSummary[]> => {
      if (!user) return [];
      const mapCachedToSummary = (cached: any[]): CollectionSummary[] => {
        return cached.map(c => ({
          id: c.id,
          title: c.title,
          description: c.description,
          verseCount: c.verseCount ?? c.itemCount ?? 0,
          comparisonCount: c.comparisonCount ?? 0,
          connectionCount: c.connectionCount ?? 0,
          createdAt: c.createdAt ?? new Date().toISOString(),
          updatedAt: c.updatedAt ?? new Date().toISOString(),
          baseSurahId: c.baseSurahId,
          baseSurahNameArabic: c.baseSurahNameArabic,
        }));
      };

      if (!navigator.onLine) {
        const cached = await getCachedUserCollections(user.id);
        return mapCachedToSummary(cached);
      }
      try {
        const res = await api.get<CollectionSummary[]>('/collections');
        await setCachedUserCollections(user.id, res.data || []);
        return res.data || [];
      } catch (err) {
        console.warn('Failed to fetch collections from network, loading cached:', err);
        const cached = await getCachedUserCollections(user.id);
        return mapCachedToSummary(cached);
      }
    },
  });

  // Load surahs list for the new collection dropdown
  const { data: surahs = [] } = useQuery<CompactSurah[]>({
    queryKey: ['surahsListModal'],
    networkMode: 'always',
    enabled: isOpen,
    queryFn: async () => {
      try {
        const db = await getQuranDB();
        const localSurahs = await db.getAll('surahs');
        if (localSurahs && localSurahs.length > 0) {
          return localSurahs.sort((a, b) => a.number - b.number);
        }
      } catch (e) {
        console.warn('Failed to load local surahs', e);
      }
      if (navigator.onLine) {
        try {
          const res = await api.get<any[]>('/quran/surahs');
          return res.data;
        } catch {}
      }
      return [];
    },
  });

  // Switch to 'new' tab automatically if user has no collections once loaded
  useEffect(() => {
    if (!isLoadingCollections && collections.length === 0) {
      setActiveTab('new');
    } else if (collections.length > 0 && !selectedCollectionId) {
      // Pick the first one by default if not set
      setSelectedCollectionId(collections[0].id);
    }
  }, [isLoadingCollections, collections]);

  // When selected collection changes, if it is a surah collection, auto-align anchor verse
  useEffect(() => {
    if (!selectedCollectionId || selectedVerses.length === 0 || isAnchorManuallySelected) return;
    const col = collections.find(c => c.id === selectedCollectionId);
    if (col && col.baseSurahId) {
      const match = selectedVerses.find(v => v.surahId === col.baseSurahId);
      if (match && match.id !== anchorVerseId) {
        setAnchorVerseId(match.id);
        if (!isTitleCustom) {
          setPositionTitle(generatePositionTitle(match, selectedVerses));
        }
      }
    }
  }, [selectedCollectionId, collections, selectedVerses, isAnchorManuallySelected]);

  // Update auto-title when anchor verse changes (unless user typed a custom title)
  const handleAnchorSelect = (verseId: number) => {
    setAnchorVerseId(verseId);
    setIsAnchorManuallySelected(true);
    const chosen = selectedVerses.find(v => v.id === verseId);
    if (!isTitleCustom && chosen) {
      setPositionTitle(generatePositionTitle(chosen, selectedVerses));
    }
    if (chosen) {
      setNewCollectionSurahId(chosen.surahId);
      if (newCollectionType === 'surah') {
        setNewCollectionTitle(`متشابهات سورة ${chosen.surahNameArabic}`);
      }
    }
  };

  const handleResetTitle = () => {
    const chosen = selectedVerses.find(v => v.id === anchorVerseId) || selectedVerses[0];
    setPositionTitle(generatePositionTitle(chosen, selectedVerses));
    setIsTitleCustom(false);
  };

  // Filter existing collections by search query
  const filteredCollections = useMemo(() => {
    if (!collectionSearch.trim()) return collections;
    const q = collectionSearch.trim().toLowerCase();
    return collections.filter(
      c =>
        c.title.toLowerCase().includes(q) ||
        (c.baseSurahNameArabic && c.baseSurahNameArabic.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [collections, collectionSearch]);

  const activeAnchorVerse = useMemo(() => {
    return selectedVerses.find(v => v.id === anchorVerseId) || selectedVerses[0];
  }, [selectedVerses, anchorVerseId]);

  // Submit Mutation
  const savePositionMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error(t('يرجى تسجيل الدخول أولاً للمتابعة.', 'Please sign in first to continue.'));
      }
      if (selectedVerses.length === 0) {
        throw new Error(t('يرجى تحديد آية واحدة على الأقل.', 'Please select at least one verse.'));
      }

      const quranVerseIds = selectedVerses.map(v => v.id);
      const comparisonBody = {
        title: positionTitle.trim() || generatePositionTitle(activeAnchorVerse, selectedVerses),
        description: description.trim() || undefined,
        sharedPhrases: sharedPhrases.trim() || undefined,
        quranVerseIds,
        anchorQuranVerseId: anchorVerseId || activeAnchorVerse?.id,
      };

      let targetCollectionId = selectedCollectionId;

      // 1. If 'new' tab: create the collection first
      if (activeTab === 'new') {
        const selectedSurah = surahs.find(
          s => s.id === Number(newCollectionSurahId) || s.number === Number(newCollectionSurahId)
        );
        const baseSurahId =
          newCollectionType === 'surah' ? selectedSurah?.id || Number(newCollectionSurahId) : undefined;
        const baseSurahNameArabic = newCollectionType === 'surah' ? selectedSurah?.nameArabic : undefined;

        const collPayload = {
          title:
            newCollectionTitle.trim() ||
            (baseSurahNameArabic ? `متشابهات سورة ${baseSurahNameArabic}` : 'مجموعة متشابهات جديدة'),
          description: newCollectionDescription.trim() || undefined,
          baseSurahId,
          quranVerseIds,
        };

        if (!navigator.onLine) {
          const tempColId = `temp-${crypto.randomUUID()}`;
          const now = new Date().toISOString();
          const collectionDetail: any = {
            id: tempColId,
            userId: user.id,
            title: collPayload.title,
            description: collPayload.description,
            baseSurahId: collPayload.baseSurahId,
            baseSurahNameArabic,
            createdAt: now,
            updatedAt: now,
            verses: selectedVerses.map((v, idx) => ({
              id: `temp-v-${crypto.randomUUID()}`,
              collectionId: tempColId,
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

          const collectionSummary: CollectionSummary = {
            id: tempColId,
            title: collPayload.title,
            description: collPayload.description,
            baseSurahId: collPayload.baseSurahId,
            baseSurahNameArabic,
            verseCount: selectedVerses.length,
            comparisonCount: 1,
            connectionCount: 0,
            createdAt: now,
            updatedAt: now,
            surahNames: Array.from(new Set(selectedVerses.map(v => v.surahNameArabic))),
          };

          await setCachedCollectionDetail(user.id, collectionDetail);
          const cachedCols = await getCachedUserCollections(user.id);
          await setCachedUserCollections(user.id, [collectionSummary, ...cachedCols]);

          await enqueueOutboxOperation({
            id: crypto.randomUUID(),
            userId: user.id,
            type: 'CREATE_COLLECTION',
            entityId: tempColId,
            payload: collPayload,
            timestamp: Date.now(),
            status: 'PENDING',
          });

          targetCollectionId = tempColId;
        } else {
          const res = await api.post('/collections', collPayload);
          targetCollectionId = res.data.id;
          await setCachedCollectionDetail(user.id, res.data);
        }
      }

      if (!targetCollectionId) {
        throw new Error(t('يرجى اختيار مجموعة لحفظ الموضع بداخلها.', 'Please choose a collection.'));
      }

      // 2. Create the comparison position inside targetCollectionId
      if (!navigator.onLine) {
        const tempCompId = crypto.randomUUID();
        const current = await getCachedCollectionDetail(user.id, targetCollectionId);
        if (current) {
          if (!current.verses) current.verses = [];
          const allFullVerses = await getFullVersesByIds(quranVerseIds);
          let currentOrder = (current.verses || []).length;
          const existingVerseIds = new Set((current.verses || []).map(v => v.quranVerseId));

          for (const fv of allFullVerses) {
            if (!existingVerseIds.has(fv.id)) {
              current.verses.push({
                id: `temp-v-${crypto.randomUUID()}`,
                collectionId: targetCollectionId,
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
            comparisonId: tempCompId,
            quranVerseId: v.id,
            surahNumber: v.surahNumber,
            surahNameArabic: v.surahNameArabic,
            ayahNumber: v.ayahNumber,
            uthmaniText: v.uthmaniText,
          }));

          const newComp: any = {
            id: tempCompId,
            collectionId: targetCollectionId,
            title: comparisonBody.title,
            description: comparisonBody.description,
            sharedPhrases: comparisonBody.sharedPhrases,
            anchorQuranVerseId: comparisonBody.anchorQuranVerseId,
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
            entityId: targetCollectionId,
            payload: { tempId: tempCompId, body: comparisonBody },
            timestamp: Date.now(),
            status: 'PENDING',
          });
        }

        return { collectionId: targetCollectionId, comparisonId: tempCompId, isOffline: true };
      }

      const compRes = await api.post(`/collections/${targetCollectionId}/comparisons`, comparisonBody);
      return { collectionId: targetCollectionId, comparisonId: compRes.data?.id, isOffline: false };
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      queryClient.invalidateQueries({ queryKey: ['userCollectionsModal'] });
      queryClient.invalidateQueries({ queryKey: ['collection', data.collectionId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });

      if (data.isOffline) {
        toast.info(t('تم حفظ موضع التشابه محلياً — ستتم المزامنة عند الاتصال.', 'Position saved locally — will sync when back online.'));
      } else {
        toast.success(t('تمت إضافة موضع التشابه للمجموعة بنجاح!', 'Similarity position added to collection successfully!'));
      }

      if (onSuccess) {
        onSuccess(data.collectionId, data.comparisonId);
      } else {
        onClose();
        navigate(`/collections/${data.collectionId}`);
      }
    },
    onError: err => {
      toast.error(getApiErrorMessage(err));
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('إضافة موضع تشابه إلى مجموعة', 'Add Similarity Position to Collection')}
      maxWidth="lg"
    >
      {!isAuthenticated ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-text-primary">
              {t('تسجيل الدخول مطلوب', 'Sign in Required')}
            </h4>
            <p className="text-sm text-text-secondary mt-1">
              {t(
                'يرجى تسجيل الدخول لحفظ المتشابهات وإنشاء مواضع مقارنة في مجموعاتك.',
                'Please sign in to save similarities and create comparison positions in your collections.'
              )}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
            >
              {t('تسجيل الدخول', 'Sign In')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5" dir={direction}>
          {/* Tabs: Existing Collection vs New Collection */}
          <div className="flex border-b border-border text-sm font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('existing')}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 border-b-2 font-bold transition-colors',
                activeTab === 'existing'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              <FolderPlus className="w-4 h-4" />
              <span>{t('إضافة لمجموعة موجودة', 'Add to Existing Collection')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={cn(
                'flex items-center gap-2 py-2.5 px-4 border-b-2 font-bold transition-colors',
                activeTab === 'new'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('إنشاء مجموعة جديدة بالآيتين', 'Create New Collection with Verses')}</span>
            </button>
          </div>

          {/* TAB 1: Existing Collection Selection */}
          {activeTab === 'existing' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-text-primary">
                {t('اختر المجموعة المستهدفة:', 'Select Target Collection:')}
              </label>

              {collections.length > 2 && (
                <div className="relative">
                  <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={collectionSearch}
                    onChange={e => setCollectionSearch(e.target.value)}
                    placeholder={t('ابحث في مجموعاتك...', 'Search your collections...')}
                    className="w-full ps-9 pe-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {isLoadingCollections ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  {t('جاري تحميل المجموعات...', 'Loading collections...')}
                </div>
              ) : collections.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-xs text-text-secondary">
                    {t('لا توجد لديك مجموعات حتى الآن.', 'You don’t have any collections yet.')}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab('new')}>
                    {t('+ إنشاء مجموعة جديدة وحفظ الموضع بها', '+ Create new collection and save position')}
                  </Button>
                </div>
              ) : filteredCollections.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-muted">
                  {t('لا توجد نتائج مطابقة لبحثك.', 'No matching collections.')}
                </div>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-2 pe-1">
                  {filteredCollections.map(col => {
                    const isSelected = selectedCollectionId === col.id;
                    return (
                      <button
                        type="button"
                        key={col.id}
                        onClick={() => setSelectedCollectionId(col.id)}
                        className={cn(
                          'w-full text-start p-3 rounded-xl border transition flex items-center justify-between gap-3',
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:border-border-hover bg-surface'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-text-primary truncate">
                              {col.title}
                            </span>
                            {col.baseSurahNameArabic && (
                              <Badge variant="primary" size="sm">
                                {t('الأساس: سورة', 'Base: Surah')} {col.baseSurahNameArabic}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted mt-1 flex items-center gap-2">
                            <span>
                              {toArabicDigits(col.comparisonCount)}{' '}
                              {t('مواضع تشابه', 'similarity positions')}
                            </span>
                            <span>•</span>
                            <span>
                              {toArabicDigits(col.verseCount)} {t('آيات', 'verses')}
                            </span>
                          </div>
                        </div>

                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-border bg-background'
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: New Collection Creation */}
          {activeTab === 'new' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-background border border-border">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCollectionType('surah');
                    if (activeAnchorVerse) {
                      setNewCollectionTitle(`متشابهات سورة ${activeAnchorVerse.surahNameArabic}`);
                    }
                  }}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition text-center',
                    newCollectionType === 'surah'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface text-text-secondary border-border hover:border-border-hover'
                  )}
                >
                  {t('مجموعة سورة (مرجع محدد)', 'Surah Collection (Specific Base)')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCollectionType('custom');
                    if (!newCollectionTitle || newCollectionTitle.startsWith('متشابهات سورة')) {
                      setNewCollectionTitle('مجموعة متشابهات موضوعية');
                    }
                  }}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition text-center',
                    newCollectionType === 'custom'
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface text-text-secondary border-border hover:border-border-hover'
                  )}
                >
                  {t('مجموعة موضوعية / حرة', 'Thematic / Custom Collection')}
                </button>
              </div>

              {newCollectionType === 'surah' && surahs.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">
                    {t('السورة الأساس (المرجع الذي تُبنى عليه المجموعة):', 'Base Surah:')}
                  </label>
                  <Select
                    value={newCollectionSurahId}
                    onChange={e => {
                      const sid = Number(e.target.value);
                      setNewCollectionSurahId(sid);
                      const s = surahs.find(item => item.id === sid || item.number === sid);
                      if (s) {
                        setNewCollectionTitle(`متشابهات سورة ${s.nameArabic}`);
                      }
                    }}
                  >
                    {surahs.map(s => (
                      <option key={s.id || s.number} value={s.id || s.number}>
                        {s.number}. سورة {s.nameArabic} ({toArabicDigits(s.ayahCount)} آية)
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  {t('عنوان المجموعة الجديدة:', 'New Collection Title:')}
                </label>
                <Input
                  type="text"
                  value={newCollectionTitle}
                  onChange={e => setNewCollectionTitle(e.target.value)}
                  placeholder={t('مثال: متشابهات سورة البقرة', 'e.g. Al-Baqarah Similarities')}
                  required
                />
              </div>
            </div>
          )}

          {/* Section: Selected Verses Review & Anchor Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{t('الآيات المحددة لهذا الموضع (حدد الآية المرجع/الأساس):', 'Verses for this Position (Select Anchor Verse):')}</span>
              </label>
              <span className="text-[11px] text-text-muted">
                {toArabicDigits(selectedVerses.length)} {t('آيات', 'verses')}
              </span>
            </div>

            <div className="space-y-2">
              {selectedVerses.map((verse, idx) => {
                const isAnchor = verse.id === anchorVerseId;
                return (
                  <div
                    key={verse.id}
                    onClick={() => handleAnchorSelect(verse.id)}
                    className={cn(
                      'p-3 rounded-xl border transition cursor-pointer text-start relative',
                      isAnchor
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border hover:border-border-hover bg-surface'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-text-primary">
                          سورة {verse.surahNameArabic} [آية {toArabicDigits(verse.ayahNumber)}]
                        </span>
                      </div>

                      {isAnchor ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary text-white">
                          <Check className="w-3 h-3" />
                          <span>{t('موضع الأساس (المرجع)', 'Anchor / Base Reference')}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-testid={`set-anchor-${verse.id}`}
                          onClick={e => {
                            e.stopPropagation();
                            handleAnchorSelect(verse.id);
                          }}
                          className="text-[11px] text-text-muted hover:text-primary transition underline cursor-pointer"
                        >
                          {t('تعيين كمرجع أساسي', 'Set as Anchor')}
                        </button>
                      )}
                    </div>

                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-quran text-sm sm:text-base leading-relaxed text-text-primary text-start"
                    >
                      {verse.uthmaniText}{' '}
                      <span className="ayah-number-badge text-primary font-bold text-xs inline-block">
                        {formatAyahOrnament(verse.ayahNumber)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Position Title & Optional Metadata */}
          <div className="space-y-3 pt-1 border-t border-border">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                  <span>{t('عنوان موضع التشابه:', 'Position Title:')}</span>
                </label>
                {isTitleCustom && (
                  <button
                    type="button"
                    onClick={handleResetTitle}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('استعادة العنوان التلقائي', 'Reset to Auto Title')}</span>
                  </button>
                )}
              </div>
              <Input
                type="text"
                data-testid="position-title-input"
                value={positionTitle}
                onChange={e => {
                  setPositionTitle(e.target.value);
                  setIsTitleCustom(true);
                }}
                placeholder={t('اكتب عنواناً معبراً عن موضع التشابه', 'Position title')}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t('الألفاظ والعبارات المشتركة في هذا الموضع (اختياري):', 'Shared Phrases (Optional):')}
                </label>
                <Input
                  type="text"
                  value={sharedPhrases}
                  onChange={e => setSharedPhrases(e.target.value)}
                  placeholder={t('مثال: ﴿ٱلۡحَمۡدُ لِلَّهِ﴾', 'e.g. Shared phrases')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {t('ملاحظات وتوجيه للموضع (اختياري):', 'Position Notes / Explanation (Optional):')}
                </label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('أضف ضابطاً أو ملاحظة لحفظ هذا الموضع وعدم الالتباس فيه...', 'Add memorization tips or notes...')}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={savePositionMutation.isPending}
            >
              {t('إلغاء', 'Cancel')}
            </Button>

            <Button
              type="button"
              variant="primary"
              isLoading={savePositionMutation.isPending}
              disabled={activeTab === 'existing' && !selectedCollectionId}
              onClick={() => savePositionMutation.mutate()}
              icon={<Check className="w-4 h-4" />}
            >
              {activeTab === 'existing'
                ? t('حفظ وإضافة الموضع للمجموعة', 'Save & Add Position to Collection')
                : t('إنشاء المجموعة وحفظ الموضع', 'Create Collection & Save Position')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
