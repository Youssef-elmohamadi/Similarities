import React, { useState } from 'react';
import type { SimilarityProposal } from '@/types/chat';
import { VerseText } from '@/components/quran/VerseText';
import { useSaveProposalToCollection } from '@/hooks/useAiChat';
import {
  Check,
  Loader2,
  Sparkles,
  AlertCircle,
  Link2,
  FolderPlus,
  Edit3,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

interface ProposalCardProps {
  proposal: SimilarityProposal;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal }) => {
  const [isApproved, setIsApproved] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [title, setTitle] = useState(proposal.title || 'اقتراح قرآني');
  const [description, setDescription] = useState(proposal.description || proposal.reason || '');
  const [note, setNote] = useState(proposal.note || '');

  const saveMutation = useSaveProposalToCollection();
  const type = proposal.type || 'comparison';

  // Normalize verses list
  const versesToRender =
    proposal.verses && proposal.verses.length > 0
      ? proposal.verses
      : proposal.sourceVerse && proposal.targetVerse
      ? [proposal.sourceVerse, proposal.targetVerse]
      : [];

  const handleApprove = async () => {
    try {
      await saveMutation.mutateAsync({
        newCollectionTitle: title,
        proposal: {
          ...proposal,
          title,
          description,
          note,
          verses: versesToRender,
        },
      });
      setIsApproved(true);
      setIsEditing(false);
    } catch {
      // Handled by saveMutation.isError
    }
  };

  const getProposalHeader = () => {
    switch (type) {
      case 'collection':
        return {
          title: 'إنشاء مجموعة',
          icon: FolderPlus,
          badge: 'اقتراح مجموعة',
        };
      case 'connection':
        return {
          title: 'أضف رابط حفظ',
          icon: Link2,
          badge: `رابط حفظي (${proposal.connectionType || 'ذهني'})`,
        };
      default:
        return {
          title: 'أضف مقارنة',
          icon: Sparkles,
          badge: 'اقتراح مقارنة متشابهات',
        };
    }
  };

  const headerInfo = getProposalHeader();
  const HeaderIcon = headerInfo.icon;

  if (isDismissed) {
    return (
      <div className="my-2 p-2.5 rounded-xl border border-border/60 bg-surface/50 text-xs text-text-muted flex items-center justify-between">
        <div className="flex items-center gap-1.5 line-through">
          <HeaderIcon className="w-3.5 h-3.5" />
          <span>{title} (تم التجاهل)</span>
        </div>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-primary hover:underline text-[11px] font-medium"
        >
          استعادة
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'my-3 border rounded-2xl p-4 transition-all shadow-xs',
        isApproved
          ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
          : 'border-primary/25 bg-primary/5 dark:bg-primary/10'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-primary/15">
        <div className="flex items-center gap-2 text-primary font-bold text-sm md:text-base">
          <HeaderIcon className="w-4 h-4 shrink-0 text-primary" />
          <span>{headerInfo.title}: {title}</span>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
          {headerInfo.badge}
        </span>
      </div>

      {/* Description or Reason */}
      {description && !isEditing && (
        <div className="text-xs md:text-sm text-text-secondary mb-2 leading-relaxed">
          {description}
        </div>
      )}

      {/* Edit Mode Inputs */}
      {isEditing && (
        <div className="space-y-2.5 p-3 rounded-xl bg-surface border border-primary/20 mb-3 text-xs">
          <div>
            <label className="block text-text-secondary font-medium mb-1">
              عنوان {headerInfo.title}:
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-text-secondary font-medium mb-1">
              الوصف / وجه الشبه:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-text-secondary font-medium mb-1">
              ملاحظة شخصية:
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="أضف ملاحظة حفظية..."
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Verses List with verified VerseText component */}
      <div className="space-y-2.5 my-3">
        {versesToRender.map((verse, idx) => (
          <div
            key={`${verse.verseId || idx}`}
            className="p-3 rounded-xl bg-surface border border-border text-start shadow-2xs"
          >
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <span className="font-semibold text-primary">
                سورة {verse.surahName || verse.surahNumber} {verse.ayahNumber ? `(الآية ${verse.ayahNumber})` : ''}
              </span>
              {verse.verseId && (
                <span className="text-[10px] text-text-muted">معرف الآية: {verse.verseId}</span>
              )}
            </div>
            <div className="py-1">
              <VerseText
                uthmaniText={verse.uthmaniText}
                ayahNumber={verse.ayahNumber}
                showOrnament={true}
              />
            </div>
            {verse.note && (
              <div className="mt-1 text-[11px] text-text-muted italic">
                ملاحظة: {verse.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Differences */}
      {proposal.differences && (
        <div className="p-2.5 rounded-lg bg-surface/80 border border-border text-xs text-text-secondary my-2.5 leading-relaxed">
          <span className="font-semibold text-text-primary block mb-0.5">الفروق اللفظية:</span>
          {proposal.differences}
        </div>
      )}

      {/* Note */}
      {note && !isEditing && (
        <div className="text-xs text-text-muted italic my-2">
          ملاحظة: {note}
        </div>
      )}

      {/* Error state */}
      {saveMutation.isError && (
        <div className="my-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'تعذر اعتماد الاقتراح وحفظه، يرجى المحاولة ثانية.'}
          </span>
        </div>
      )}

      {/* Actions: Approve / Edit then approve / Dismiss */}
      <div className="mt-3 pt-2.5 border-t border-primary/15 flex flex-wrap items-center justify-between gap-2">
        {isApproved ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold py-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم الاعتماد والإضافة إلى مكتبتك بنجاح</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {/* Approve Button */}
              <Button
                size="sm"
                variant="primary"
                onClick={handleApprove}
                disabled={saveMutation.isPending || !title.trim()}
                className="gap-1.5 text-xs"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{isEditing ? 'تأكيد واعتماد' : 'اعتماد'}</span>
              </Button>

              {/* Edit then Approve Button */}
              {!isEditing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  disabled={saveMutation.isPending}
                  className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل ثم اعتماد</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsEditing(false)}
                  disabled={saveMutation.isPending}
                  className="text-xs"
                >
                  إلغاء التعديل
                </Button>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => setIsDismissed(true)}
              disabled={saveMutation.isPending}
              className="text-xs text-text-muted hover:text-red-500 inline-flex items-center gap-1 transition px-2 py-1 rounded"
              title="تجاهل الاقتراح"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>تجاهل</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
