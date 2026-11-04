import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardStats } from '@/types/collection';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton, CollectionCardSkeleton } from '@/components/common/Skeleton';
import { CollectionCard } from '@/components/collection/CollectionCard';
import { ListRow } from '@/components/common/ListRow';
import { FAB } from '@/components/common/FAB';
import { SectionToolbar } from '@/components/common/SectionToolbar';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits, formatRelativeTime } from '@/lib/utils';
import { Seo } from '@/components/common/Seo';
import {
  BookMarked,
  Layers,
  GitCompare,
  Sparkles,
  Search,
  PlusCircle,
  BookOpen,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState('');

  const isRtl = direction === 'rtl';
  const NextIcon = isRtl ? ArrowLeft : ArrowRight;

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get<DashboardStats>('/collections/dashboard');
      return res.data;
    },
  });

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(quickQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in text-start pb-6">
      <Seo title="لوحة التحكم" robots="noindex, nofollow" />

      {/* ========================================================= */}
      {/* 1. Welcome Banner (Desktop unchanged, Mobile compact)     */}
      {/* ========================================================= */}
      {/* Desktop Banner (>= 768px) */}
      <div 
        className="hidden md:block relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0F5C4A] via-[#0B4738] to-[#08382C] text-white p-5 sm:p-6 shadow-sm border border-[#0B4738]"
        style={{ backgroundColor: '#0F5C4A' }}
      >
        <div className="relative z-10 max-w-xl space-y-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[#E6F2EE] text-xs font-semibold border border-white/10">
            <BookOpen className="w-3.5 h-3.5 text-[#B8924A]" />
            <span>{t('مساحة الحفظ والتدبر الخاصة', 'Private Memorization Space')}</span>
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug text-white">
            {t('مرحباً بك في منصة إدارة المتشابهات القرآنية', 'Welcome to Quranic Similarities Platform')}
          </h1>
          <p className="text-xs sm:text-sm text-[#E6F2EE]/90 leading-relaxed font-normal">
            {t(
              'منصتك الشخصية المنظمة لتتبع الآيات المتشابهة، رصد الفروق الدقيقة، وتدوين طرائق الحفظ والربط الخاصة بك.',
              'Your organized personal workspace to track similar verses, document nuanced differences, and anchor mnemonics.'
            )}
          </p>

          {/* Quick Search inside Banner */}
          <form onSubmit={handleQuickSearch} className="pt-1.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 start-3 my-auto w-4 h-4 text-white/70 pointer-events-none" />
              <input
                type="text"
                value={quickQuery}
                onChange={e => setQuickQuery(e.target.value)}
                placeholder={t('ابحث عن آية أو لفظ قرآني...', 'Search a verse or word in Quran...')}
                className="w-full h-10 ps-9 pe-4 text-xs sm:text-sm bg-white/15 border border-white/25 rounded-lg text-white placeholder:text-white/70 focus:outline-none focus:bg-white focus:text-[#1F2937] focus:placeholder:text-[#5B6472] transition text-start"
              />
            </div>
            <Button type="submit" variant="gold" size="sm" className="shrink-0 min-h-[40px] px-4 font-medium text-xs sm:text-sm">
              {t('بحث في المصحف', 'Search Quran')}
            </Button>
          </form>
        </div>
      </div>

      {/* Mobile Compact Banner (< 768px) */}
      <div className="md:hidden p-3 rounded-xl bg-gradient-to-br from-[#0F5C4A] to-[#08382C] text-white space-y-2 border border-[#0B4738]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-[#DEBF83]" />
            </div>
            <h1 className="text-sm font-bold text-white truncate">
              {t('منصة المتشابهات القرآنية', 'Quranic Similarities')}
            </h1>
          </div>
          <Link
            to="/search"
            className="text-[11px] text-[#E6F2EE] hover:text-white font-medium flex items-center gap-0.5 shrink-0"
          >
            <span>{t('بحث سريع', 'Search')}</span>
            <NextIcon className="w-3 h-3" />
          </Link>
        </div>

        <form onSubmit={handleQuickSearch} className="relative">
          <Search className="absolute inset-y-0 start-2.5 my-auto w-3.5 h-3.5 text-white/70 pointer-events-none" />
          <input
            type="text"
            value={quickQuery}
            onChange={e => setQuickQuery(e.target.value)}
            placeholder={t('ابحث عن آية أو لفظ في المصحف...', 'Search verse or word in Quran...')}
            className="w-full h-9 ps-8 pe-3 text-xs bg-white/15 border border-white/20 rounded-lg text-white placeholder:text-white/70 focus:outline-none focus:bg-white focus:text-[#1F2937] focus:placeholder:text-[#5B6472] transition text-start"
          />
        </form>
      </div>

      {/* ========================================================= */}
      {/* 2. Metrics (Desktop 4 cards, Mobile compact 2-col grid)   */}
      {/* ========================================================= */}
      {/* Desktop Metrics (>= 768px) */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary-tint text-primary flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              {t('مجموعات المتشابهات', 'Total Collections')}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-14 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-text-primary mt-0.5 leading-none">
                {isRtl ? toArabicDigits(stats?.totalCollections || 0) : stats?.totalCollections || 0}
              </h3>
            )}
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-accent-tint text-accent flex items-center justify-center shrink-0">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              {t('الآيات المقيدة بالمجموعات', 'Saved Verses')}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-14 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-text-primary mt-0.5 leading-none">
                {isRtl ? toArabicDigits(stats?.totalSavedVerses || 0) : stats?.totalSavedVerses || 0}
              </h3>
            )}
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-sky-50 text-sky-800 flex items-center justify-center shrink-0">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              {t('المقارنات المرصودة', 'Comparisons')}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-14 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-text-primary mt-0.5 leading-none">
                {isRtl ? toArabicDigits(stats?.totalComparisons || 0) : stats?.totalComparisons || 0}
              </h3>
            )}
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-secondary">
              {t('روابط الحفظ المكتوبة', 'Memorization Links')}
            </p>
            {isLoading ? (
              <Skeleton className="h-7 w-14 mt-1" />
            ) : (
              <h3 className="text-2xl font-bold text-text-primary mt-0.5 leading-none">
                {isRtl ? toArabicDigits(stats?.totalConnections || 0) : stats?.totalConnections || 0}
              </h3>
            )}
          </div>
        </Card>
      </div>

      {/* Mobile Compact 2-column Grid (< 768px) */}
      <div className="md:hidden grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg border border-border bg-surface flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary-tint text-primary flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block leading-tight">
              {isLoading ? '...' : (isRtl ? toArabicDigits(stats?.totalCollections || 0) : stats?.totalCollections || 0)}
            </span>
            <span className="text-[10px] text-text-secondary truncate block">
              {t('المجموعات', 'Collections')}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-surface flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent-tint text-accent flex items-center justify-center shrink-0">
            <BookMarked className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block leading-tight">
              {isLoading ? '...' : (isRtl ? toArabicDigits(stats?.totalSavedVerses || 0) : stats?.totalSavedVerses || 0)}
            </span>
            <span className="text-[10px] text-text-secondary truncate block">
              {t('الآيات المقيدة', 'Verses')}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-surface flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-sky-50 text-sky-800 flex items-center justify-center shrink-0">
            <GitCompare className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block leading-tight">
              {isLoading ? '...' : (isRtl ? toArabicDigits(stats?.totalComparisons || 0) : stats?.totalComparisons || 0)}
            </span>
            <span className="text-[10px] text-text-secondary truncate block">
              {t('المقارنات', 'Comparisons')}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-surface flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary block leading-tight">
              {isLoading ? '...' : (isRtl ? toArabicDigits(stats?.totalConnections || 0) : stats?.totalConnections || 0)}
            </span>
            <span className="text-[10px] text-text-secondary truncate block">
              {t('روابط الحفظ', 'Links')}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. Section Header & Shortcuts                             */}
      {/* ========================================================= */}
      {/* Desktop Section Header (>= 768px) */}
      <div className="hidden md:flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-text-primary leading-snug">
            {t('المجموعات المحدثة مؤخراً', 'Recently Updated Collections')}
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {t('تابع دراسة ومراجعة مجموعاتك ومقارناتك القرآنية', 'Continue reviewing and expanding your personal library')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/search">
            <Button size="sm" variant="outline" icon={<Search className="w-4 h-4" />}>
              {t('البحث في المصحف', 'Search Quran')}
            </Button>
          </Link>

          <Link to="/collections/new">
            <Button size="sm" variant="primary" icon={<PlusCircle className="w-4 h-4" />}>
              {t('مجموعة جديدة', 'New Collection')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Section Header (< 768px) */}
      <div className="md:hidden">
        <SectionToolbar
          title={t('المجموعات المحدثة مؤخراً', 'Recent Collections')}
          action={{
            label: t('عرض الكل', 'View All'),
            onClick: () => navigate('/library'),
          }}
        />
      </div>

      {/* ========================================================= */}
      {/* 4. Recent Collections (Desktop Cards vs Mobile ListRows)  */}
      {/* ========================================================= */}
      {isLoading ? (
        <>
          {/* Desktop Skeleton */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map(i => (
              <CollectionCardSkeleton key={i} />
            ))}
          </div>
          {/* Mobile Skeleton */}
          <div className="md:hidden divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="min-h-[52px] p-3 flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </>
      ) : stats?.recentCollections && stats.recentCollections.length > 0 ? (
        <>
          {/* Desktop Cards Grid (>= 768px) - 100% Unchanged */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {stats.recentCollections.map(col => (
              <CollectionCard key={col.id} collection={col} />
            ))}
          </div>

          {/* Mobile High-Density ListRows (< 768px) */}
          <div className="md:hidden divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
            {stats.recentCollections.map((col, idx) => {
              const countText = `${isRtl ? toArabicDigits(col.verseCount || 0) : col.verseCount || 0} ${t('آيات', 'ayahs')}`;
              const timeText = col.updatedAt ? formatRelativeTime(col.updatedAt) : '';

              return (
                <ListRow
                  key={col.id}
                  index={idx + 1}
                  title={col.title}
                  subtitle={col.baseSurahNameArabic ? `${t('سورة', 'Surah')} ${col.baseSurahNameArabic}` : undefined}
                  meta={`${countText} · ${timeText}`}
                  onClick={() => navigate(`/collections/${col.id}`)}
                  actions={
                    <button
                      type="button"
                      aria-label={t('فتح المجموعة', 'Open collection')}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary transition"
                    >
                      <NextIcon className="w-4 h-4" />
                    </button>
                  }
                />
              );
            })}
          </div>
        </>
      ) : (
        <Card className="text-center py-8 md:py-12 px-4 border-dashed">
          <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-text-secondary/40 mx-auto mb-2 md:mb-3" />
          <h3 className="font-semibold text-base md:text-lg text-text-primary mb-1">
            {t('لم تنشئ أي مجموعة بعد', "You haven't created any collections yet")}
          </h3>
          <p className="text-xs md:text-sm text-text-secondary max-w-md mx-auto mb-4 leading-relaxed">
            {t(
              'ابدأ بالبحث في آيات القرآن الكريم، وحدد الآيات المتشابهة لإنشاء أول مجموعة دراسة خاصة بك.',
              'Start by searching verses in the Holy Quran, select matching verses, and create your first similarity collection.'
            )}
          </p>
          <Link to="/search">
            <Button variant="primary" size="sm" icon={<Search className="w-4 h-4" />}>
              {t('ابدأ البحث القرآني الآن', 'Start Quran Search')}
            </Button>
          </Link>
        </Card>
      )}

      {/* Mobile Floating Action Button for "+ مجموعة جديدة" */}
      <FAB
        to="/collections/new"
        ariaLabel={t('إنشاء مجموعة جديدة', 'Create new collection')}
      />
    </div>
  );
};
