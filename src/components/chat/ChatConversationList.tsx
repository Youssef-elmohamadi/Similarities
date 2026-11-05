import React, { useState } from 'react';
import type { ChatConversation } from '@/types/chat';
import { Plus, MessageSquare, Trash2, Search, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

interface ChatConversationListProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  isLoading?: boolean;
}

// Group conversations by date bucket
function groupConversationsByDate(conversations: ChatConversation[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const startOfYesterday = startOfToday - oneDayMs;
  const sevenDaysAgo = startOfToday - 6 * oneDayMs;
  const thirtyDaysAgo = startOfToday - 29 * oneDayMs;

  const groups: {
    today: ChatConversation[];
    yesterday: ChatConversation[];
    lastWeek: ChatConversation[];
    lastMonth: ChatConversation[];
    older: ChatConversation[];
  } = {
    today: [],
    yesterday: [],
    lastWeek: [],
    lastMonth: [],
    older: [],
  };

  for (const conv of conversations) {
    const time = new Date(conv.updatedAt).getTime();
    if (time >= startOfToday) {
      groups.today.push(conv);
    } else if (time >= startOfYesterday) {
      groups.yesterday.push(conv);
    } else if (time >= sevenDaysAgo) {
      groups.lastWeek.push(conv);
    } else if (time >= thirtyDaysAgo) {
      groups.lastMonth.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  return [
    { title: 'اليوم', items: groups.today },
    { title: 'أمس', items: groups.yesterday },
    { title: 'آخر 7 أيام', items: groups.lastWeek },
    { title: 'هذا الشهر', items: groups.lastMonth },
    { title: 'سابقاً', items: groups.older },
  ].filter((g) => g.items.length > 0);
}

export const ChatConversationList: React.FC<ChatConversationListProps> = ({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
}) => {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filtered = (conversations || [])
    .filter((c): c is ChatConversation => Boolean(c && c.id && c.title))
    .filter((c) =>
      search ? c.title.toLowerCase().includes(search.toLowerCase()) : true
    );

  const grouped = groupConversationsByDate(filtered);

  const startRename = (conv: ChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const submitRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editingTitle.trim() && onRename) {
      onRename(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-surface border-e border-border">
      {/* Header & New Chat button */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <button
          type="button"
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-white text-xs md:text-sm font-semibold hover:bg-primary-hover active:scale-[0.99] transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>محادثة جديدة</span>
        </button>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المحادثات..."
            className="w-full ps-8 pe-3 py-1.5 text-xs rounded-lg border border-border bg-background text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Grouped Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">
            {search
              ? 'لا توجد نتائج بحث مطابقة'
              : 'لا توجد محادثات سابقة، ابدأ محادثة جديدة الآن.'}
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="text-[11px] font-bold text-text-muted px-2 py-0.5 select-none">
                {group.title}
              </div>

              {group.items.map((conv) => {
                const isActive = conv.id === activeId;
                const isEditingThis = conv.id === editingId;

                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    className={cn(
                      'group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-start transition-all',
                      isActive
                        ? 'bg-primary/10 border-s-4 border-s-primary text-text-primary font-medium shadow-2xs'
                        : 'hover:bg-background/80 text-text-secondary'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pe-1">
                      <MessageSquare
                        className={cn(
                          'w-4 h-4 shrink-0',
                          isActive ? 'text-primary' : 'text-text-muted'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        {isEditingThis ? (
                          <form
                            onSubmit={(e) => submitRename(conv.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1"
                          >
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              autoFocus
                              className="w-full px-2 py-0.5 text-xs rounded border border-primary bg-background text-text-primary focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 text-emerald-600 hover:text-emerald-700"
                              title="حفظ"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 text-text-muted hover:text-text-primary"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="text-xs md:text-sm truncate leading-snug">
                            {conv.title}
                          </div>
                        )}
                      </div>
                    </div>

                    {!isEditingThis && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => startRename(conv, e)}
                          className="p-1 text-text-muted hover:text-primary rounded transition"
                          title="إعادة تسمية"
                          aria-label="إعادة تسمية"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(conv.id);
                          }}
                          className="p-1 text-text-muted hover:text-red-500 rounded transition"
                          title="حذف المحادثة"
                          aria-label="حذف المحادثة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteId)}
        title="حذف المحادثة"
        message="هل أنت متأكد من رغبتك في حذف هذه المحادثة وجميع رسائلها؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={() => {
          if (deleteId) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
};
