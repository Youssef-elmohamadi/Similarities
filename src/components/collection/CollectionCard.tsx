import React from 'react';
import { Link } from 'react-router-dom';
import { CollectionSummary } from '@/types/collection';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { BookMarked, GitCompare, Sparkles, Clock, Trash2, Edit3, ArrowUpRight, ArrowUpLeft } from 'lucide-react';
import { formatRelativeTime, toArabicDigits } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface CollectionCardProps {
  collection: CollectionSummary;
  onDelete?: (id: string, title: string) => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({ collection, onDelete }) => {
  const { t, direction } = useLanguage();
  const isRtl = direction === 'rtl';
  const isOfflinePending = collection.id.startsWith('temp-');

  return (
    <Card hoverable className="group flex flex-col justify-between text-start">
      <div>
        {isOfflinePending && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              {t('محفوظ محلياً — في انتظار المزامنة', 'Saved locally — pending sync')}
            </span>
          </div>
        )}
        {/* Header & Actions */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <Link to={`/collections/${collection.id}`} className="flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            <h3 className="font-semibold text-base md:text-lg text-text-primary group-hover:text-primary transition line-clamp-1 leading-snug">
              {collection.title}
            </h3>
          </Link>

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition shrink-0">
            <Link
              to={`/collections/${collection.id}/edit`}
              className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-primary-tint transition"
              title={t('تعديل بيانات المجموعة', 'Edit Collection')}
              aria-label={t('تعديل بيانات المجموعة', 'Edit Collection')}
            >
              <Edit3 className="w-4 h-4" />
            </Link>

            {onDelete && (
              <button
                onClick={() => onDelete(collection.id, collection.title)}
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                title={t('حذف المجموعة', 'Delete Collection')}
                aria-label={t('حذف المجموعة', 'Delete Collection')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Optional Description */}
        {collection.description && (
          <p className="text-sm text-text-secondary mb-3.5 line-clamp-2 leading-relaxed">
            {collection.description}
          </p>
        )}

        {/* Surahs included */}
        {collection.surahNames && collection.surahNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3.5">
            {collection.surahNames.map(name => (
              <Badge key={name} variant="outline" size="sm">
                {t('سورة', 'Surah')} {name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats and View Link */}
      <div className="pt-3.5 border-t border-border/80 flex items-center justify-between text-xs text-text-secondary mt-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium text-primary" title={t('الآيات المتشابهة', 'Verses')}>
            <BookMarked className="w-3.5 h-3.5" />
            <span>{isRtl ? toArabicDigits(collection.verseCount) : collection.verseCount}</span>
          </span>

          <span className="flex items-center gap-1 font-medium text-accent" title={t('المقارنات', 'Comparisons')}>
            <GitCompare className="w-3.5 h-3.5" />
            <span>{isRtl ? toArabicDigits(collection.comparisonCount) : collection.comparisonCount}</span>
          </span>

          <span className="flex items-center gap-1 font-medium text-text-secondary" title={t('روابط الحفظ', 'Connections')}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? toArabicDigits(collection.connectionCount) : collection.connectionCount}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-text-secondary">
            <Clock className="w-3 h-3" />
            <span>{formatRelativeTime(collection.updatedAt)}</span>
          </span>

          <Link
            to={`/collections/${collection.id}`}
            className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary-tint transition"
            aria-label={t('فتح تفاصيل المجموعة', 'Open Collection')}
          >
            {isRtl ? <ArrowUpLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </Link>
        </div>
      </div>
    </Card>
  );
};
