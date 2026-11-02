import React, { useState } from 'react';
import { CollectionVerse } from '@/types/collection';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { ChevronUp, ChevronDown, Trash2, Edit2, Check, FileText } from 'lucide-react';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface VerseListEditorProps {
  verses: CollectionVerse[];
  onReorder: (orderedIds: string[]) => void;
  onRemoveVerse: (quranVerseId: number) => void;
  onUpdateNote: (quranVerseId: number, note: string) => void;
}

export const VerseListEditor: React.FC<VerseListEditorProps> = ({
  verses,
  onReorder,
  onRemoveVerse,
  onUpdateNote,
}) => {
  const { t, direction } = useLanguage();
  const [editingNoteVerseId, setEditingNoteVerseId] = useState<number | null>(null);
  const [noteContent, setNoteContent] = useState('');

  const isRtl = direction === 'rtl';

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...verses];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    onReorder(newItems.map(v => v.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === verses.length - 1) return;
    const newItems = [...verses];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    onReorder(newItems.map(v => v.id));
  };

  const startEditNote = (verse: CollectionVerse) => {
    setEditingNoteVerseId(verse.quranVerseId);
    setNoteContent(verse.personalNote || '');
  };

  const saveNote = (quranVerseId: number) => {
    onUpdateNote(quranVerseId, noteContent);
    setEditingNoteVerseId(null);
  };

  return (
    <div className="space-y-4">
      {verses.map((verse, index) => (
        <div
          key={verse.id}
          className="p-5 md:p-6 rounded-xl border border-border bg-surface shadow-xs hover:border-primary/40 transition duration-150 text-start"
        >
          {/* Top Bar: Order & Badges & Controls */}
          <div className="flex items-center justify-between gap-2 mb-3">
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

            {/* Actions: Move Up / Down, Remove */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                title={t('تحريك لأعلى', 'Move Up')}
                aria-label={t('تحريك لأعلى', 'Move Up')}
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleMoveDown(index)}
                disabled={index === verses.length - 1}
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-background disabled:opacity-20 transition"
                title={t('تحريك لأسفل', 'Move Down')}
                aria-label={t('تحريك لأسفل', 'Move Down')}
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onRemoveVerse(verse.quranVerseId)}
                className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                title={t('إزالة الآية من المجموعة', 'Remove Verse')}
                aria-label={t('إزالة الآية من المجموعة', 'Remove Verse')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fully Diacritized Uthmani Verse */}
          <p
            dir="rtl"
            lang="ar"
            className="font-quran text-xl md:text-2xl text-text-primary text-start leading-[2.5] py-2 mb-3 selection:bg-accent-tint"
          >
            {verse.uthmaniText}{' '}
            <span className="ayah-number-badge text-primary font-bold">
              {formatAyahOrnament(verse.ayahNumber)}
            </span>
          </p>

          {/* Personal Note per Verse */}
          <div className="pt-3 border-t border-border/80">
            {editingNoteVerseId === verse.quranVerseId ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  placeholder={t('اكتب ملاحظتك الشخصية على هذه الآية...', 'Write personal note on this verse...')}
                  className="flex-1 h-10 px-3.5 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-start"
                  autoFocus
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Check className="w-3.5 h-3.5" />}
                    onClick={() => saveNote(verse.quranVerseId)}
                  >
                    {t('حفظ', 'Save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingNoteVerseId(null)}
                  >
                    {t('إلغاء', 'Cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs sm:text-sm text-text-secondary gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-text-secondary shrink-0" />
                  {verse.personalNote ? (
                    <span className="text-text-primary italic truncate">"{verse.personalNote}"</span>
                  ) : (
                    <span className="text-text-secondary/70">{t('لا توجد ملاحظة شخصية على الآية', 'No personal note')}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => startEditNote(verse)}
                  className="min-h-[32px] inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{verse.personalNote ? t('تعديل', 'Edit') : t('إضافة ملاحظة', 'Add Note')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
