import React, { useState } from 'react';
import { Copy, Check, Bookmark, Plus, Search, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';

interface MessageActionBarProps {
  message: ChatMessage;
  onCopy?: () => void;
  onAddToCollection?: () => void;
  onSaveAsConnection?: () => void;
  onSearchMore?: () => void;
  onBookmark?: () => void;
  isBookmarked: boolean;
}

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  message,
  onCopy,
  onAddToCollection,
  onSaveAsConnection,
  onSearchMore,
  onBookmark,
  isBookmarked,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="flex items-center gap-1 mt-2 pt-1.5 border-t border-border/40 flex-wrap"
      role="toolbar"
      aria-label="خيارات الرسالة"
    >
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-md hover:bg-background/60 transition-colors"
        title="نسخ نص الرد"
      >
        {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? 'تم النسخ' : 'انسخ'}</span>
      </button>

      {onSaveAsConnection && (
        <button
          type="button"
          onClick={onSaveAsConnection}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-md hover:bg-background/60 transition-colors"
          title="حفظ كرابط حفظ بين المواضع المذكورة"
        >
          <Link2 className="w-3 h-3" />
          <span>احفظ كرابط</span>
        </button>
      )}

      {onAddToCollection && (
        <button
          type="button"
          onClick={onAddToCollection}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-md hover:bg-background/60 transition-colors"
          title="أضف الآيات المذكورة إلى مجموعة"
        >
          <Plus className="w-3 h-3" />
          <span>أضف لمجموعة</span>
        </button>
      )}

      {onSearchMore && (
        <button
          type="button"
          onClick={onSearchMore}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary px-2 py-1 rounded-md hover:bg-background/60 transition-colors"
          title="البحث عن مواضع أو تفاصيل إضافية"
        >
          <Search className="w-3 h-3" />
          <span>المزيد</span>
        </button>
      )}

      {onBookmark && (
        <button
          type="button"
          onClick={onBookmark}
          className={cn(
            'flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ms-auto',
            isBookmarked
              ? 'text-primary bg-primary/10 hover:bg-primary/15'
              : 'text-text-muted hover:text-text-secondary hover:bg-background/60'
          )}
          title={isBookmarked ? 'إلغاء الحفظ' : 'حفظ هذا الرد للرجوع إليه'}
        >
          <Bookmark className={cn('w-3 h-3', isBookmarked && 'fill-primary')} />
          <span>{isBookmarked ? 'محفوظ' : 'احفظ الرد'}</span>
        </button>
      )}
    </div>
  );
};

