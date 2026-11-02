import React, { useState } from 'react';
import { PersonalNote } from '@/types/note';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { FileText, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

export interface PersonalNotesEditorProps {
  collectionId: string;
  notes: PersonalNote[];
  onCreateNote: (content: string) => Promise<void>;
  onUpdateNote: (noteId: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const PersonalNotesEditor: React.FC<PersonalNotesEditorProps> = ({
  notes,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  const { t } = useLanguage();
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateNote(newNoteContent.trim());
      setNewNoteContent('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (note: PersonalNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdateNote(noteId, editContent.trim());
      setEditingNoteId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 text-start">
      {/* Top Banner & Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-surface border border-border">
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>{t('الملاحظات والفوائد العامة للمجموعة', 'General Notes & Reflections')}</span>
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            {t(
              'اكتب أي فوائد تفسيرية أو لغوية أو تدبرية تعينك أثناء مراجعة هذه المتشابهات.',
              'Record any tafsir, linguistic, or spiritual notes supporting your memorization.'
            )}
          </p>
        </div>

        {!isAdding && (
          <Button
            size="sm"
            variant="outline"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAdding(true)}
            className="shrink-0"
          >
            {t('ملاحظة جديدة', 'New Note')}
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {isAdding && (
        <form onSubmit={handleCreate} className="p-5 md:p-6 rounded-xl bg-surface border border-primary/40 shadow-xs space-y-4 animate-fade-in">
          <Textarea
            value={newNoteContent}
            onChange={e => setNewNoteContent(e.target.value)}
            placeholder={t('اكتب ملاحظتك أو فائدتك هنا بالتفصيل...', 'Write your note or insight here...')}
            rows={4}
            className="text-base leading-relaxed"
            autoFocus
            required
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent('');
              }}
            >
              {t('إلغاء', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={!newNoteContent.trim()}
            >
              {t('إضافة الملاحظة', 'Add Note')}
            </Button>
          </div>
        </form>
      )}

      {/* Notes List */}
      {notes.length === 0 && !isAdding ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-surface">
          <FileText className="w-10 h-10 text-text-secondary/40 mx-auto mb-3" />
          <h4 className="font-semibold text-base text-text-primary mb-1">
            {t('لا توجد ملاحظات عامة بعد', 'No notes added yet')}
          </h4>
          <p className="text-sm text-text-secondary max-w-md mx-auto mb-5 leading-relaxed">
            {t(
              'أضف فوائد عامة لربط وفهم الآيات وسياقها التفسيري.',
              'Add general notes on context, tafsir, or personal reflections.'
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            {t('إضافة أول ملاحظة', 'Add First Note')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map(note => (
            <Card key={note.id} className="p-5 md:p-6 space-y-3 border-border hover:border-primary/40 transition duration-150">
              {editingNoteId === note.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={4}
                    className="text-base leading-relaxed"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingNoteId(null)}
                    >
                      {t('إلغاء', 'Cancel')}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={isSubmitting}
                      onClick={() => handleSaveEdit(note.id)}
                    >
                      {t('حفظ التعديل', 'Save')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base text-text-primary leading-relaxed whitespace-pre-wrap flex-1">
                      {note.content}
                    </p>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEdit(note)}
                        className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-primary hover:bg-primary-tint transition"
                        title={t('تعديل الملاحظة', 'Edit Note')}
                        aria-label={t('تعديل الملاحظة', 'Edit Note')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="min-w-[34px] min-h-[34px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-danger hover:bg-danger-subtle transition"
                        title={t('حذف الملاحظة', 'Delete Note')}
                        aria-label={t('حذف الملاحظة', 'Delete Note')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-border/60 flex items-center justify-end text-xs text-text-secondary">
                    <span>{formatRelativeTime(note.updatedAt)}</span>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
