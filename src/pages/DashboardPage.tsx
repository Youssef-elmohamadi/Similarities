import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardStats } from '@/types/collection';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Skeleton, CollectionCardSkeleton } from '@/components/common/Skeleton';
import { CollectionCard } from '@/components/collection/CollectionCard';
import { useLanguage } from '@/context/LanguageContext';
import { toArabicDigits } from '@/lib/utils';
import { Seo } from '@/components/common/Seo';
import {
  BookMarked,
  Layers,
  GitCompare,
  Sparkles,
  Search,
  PlusCircle,
  BookOpen,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t, direction } = useLanguage();
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState('');

  const isRtl = direction === 'rtl';

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
    <div className="space-y-8 animate-fade-in text-start">
      <Seo title="لوحة التحكم" robots="noindex, nofollow" />
      {/* Welcome Banner */}
      <div 
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0F5C4A] via-[#0B4738] to-[#08382C] text-white p-5 sm:p-6 shadow-sm border border-[#0B4738]"
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

      {/* Metrics Row: 1 col on mobile, 2 on tablet, 4 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
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

      {/* Action shortcuts & Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
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

      {/* Recent Collections Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[1, 2, 3].map(i => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      ) : stats?.recentCollections && stats.recentCollections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {stats.recentCollections.map(col => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 px-4 border-dashed">
          <BookOpen className="w-12 h-12 text-text-secondary/40 mx-auto mb-3" />
          <h3 className="font-semibold text-lg text-text-primary mb-1">
            {t('لم تنشئ أي مجموعة بعد', "You haven't created any collections yet")}
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-5 leading-relaxed">
            {t(
              'ابدأ بالبحث في آيات القرآن الكريم، وحدد الآيات المتشابهة لإنشاء أول مجموعة دراسة خاصة بك.',
              'Start by searching verses in the Holy Quran, select matching verses, and create your first similarity collection.'
            )}
          </p>
          <Link to="/search">
            <Button variant="primary" size="md" icon={<Search className="w-4 h-4" />}>
              {t('ابدأ البحث القرآني الآن', 'Start Quran Search')}
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
};
