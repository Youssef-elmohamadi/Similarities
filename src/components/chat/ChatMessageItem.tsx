import React, { useState } from 'react';
import type { ChatMessage, SimilarityProposal } from '@/types/chat';
import { ProposalCard } from './ProposalCard';
import { SanitizedMarkdown } from './SanitizedMarkdown';
import { MessageActionBar } from './MessageActionBar';
import { Bot, User, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageItemProps {
  message: ChatMessage;
  onSendFollowUp?: (text: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onSendFollowUp }) => {
  const isUser = message.role === 'user';
  const [showTools, setShowTools] = useState(false);
  const bookmarkKey = `bookmark-msg-${message.id}`;
  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      return localStorage.getItem(bookmarkKey) === '1';
    } catch {
      return false;
    }
  });

  const handleBookmark = () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    try {
      if (next) localStorage.setItem(bookmarkKey, '1');
      else localStorage.removeItem(bookmarkKey);
    } catch {}
  };

  // Parse proposals if present
  let proposals: SimilarityProposal[] = [];
  if (message.proposalsJson) {
    try {
      const parsed = JSON.parse(message.proposalsJson);
      if (Array.isArray(parsed)) proposals = parsed;
    } catch {
      // Ignore JSON parse error
    }
  }

  // Parse tool calls if present
  let toolCalls: Array<{ name: string; argumentsJson: string }> = [];
  if (message.toolCallsJson) {
    try {
      const parsed = JSON.parse(message.toolCallsJson);
      if (Array.isArray(parsed)) toolCalls = parsed;
    } catch {
      // Ignore JSON parse error
    }
  }

  const [dynamicProposal, setDynamicProposal] = useState<SimilarityProposal | null>(null);

  const handleAddToCollection = () => {
    const matches = [...message.content.matchAll(/\[\[v:(\d+):(\d+)(?:#([0-9-]+))?\]\]/g)];
    if (matches.length > 0) {
      const verses = matches.map((m) => ({
        verseId: 0,
        surahNumber: parseInt(m[1], 10),
        surahName: `سورة ${m[1]}`,
        ayahNumber: parseInt(m[2], 10),
        uthmaniText: '',
        note: m[3] ? `الكلمات: ${m[3]}` : undefined,
      }));
      setDynamicProposal({
        id: `manual-col-${message.id}`,
        type: 'collection',
        title: 'مجموعة متشابهات مقترحة',
        description: 'تم إنشاؤها من مواضع الرد في المحادثة',
        verses,
      });
    } else {
      onSendFollowUp?.('اقترح لي إنشاء مجموعة متشابهات من الآيات المذكورة');
    }
  };

  const handleSaveAsConnection = () => {
    const matches = [...message.content.matchAll(/\[\[v:(\d+):(\d+)(?:#([0-9-]+))?\]\]/g)];
    if (matches.length >= 2) {
      const v1 = {
        verseId: 0,
        surahNumber: parseInt(matches[0][1], 10),
        surahName: `سورة ${matches[0][1]}`,
        ayahNumber: parseInt(matches[0][2], 10),
        uthmaniText: '',
      };
      const v2 = {
        verseId: 0,
        surahNumber: parseInt(matches[1][1], 10),
        surahName: `سورة ${matches[1][1]}`,
        ayahNumber: parseInt(matches[1][2], 10),
        uthmaniText: '',
      };
      setDynamicProposal({
        id: `manual-conn-${message.id}`,
        type: 'connection',
        title: `رابط حفظ بين ${v1.surahNumber}:${v1.ayahNumber} و ${v2.surahNumber}:${v2.ayahNumber}`,
        sourceVerse: v1,
        targetVerse: v2,
        verses: [v1, v2],
        note: 'رابط حفظ مقترح للمراجعة والتثبيت',
      });
    } else {
      onSendFollowUp?.('اقترح رابط حفظ بين الآيات المذكورة');
    }
  };

  const allProposals = (dynamicProposal ? [...proposals, dynamicProposal] : proposals).filter(
    (p): p is SimilarityProposal => Boolean(p)
  );

  return (
    <div
      className={cn(
        'flex gap-2.5 md:gap-3.5 my-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs select-none shadow-xs',
          isUser
            ? 'bg-primary text-white'
            : 'bg-primary/10 text-primary border border-primary/25'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Content */}
      <div
        className={cn(
          'rounded-2xl leading-relaxed shadow-xs transition-all box-border break-words w-fit',
          isUser
            ? 'min-w-[90px] max-w-[85%] md:max-w-[70%] px-4 py-2.5 bg-primary text-white rounded-tr-xs shadow-xs text-sm md:text-[15px]'
            : 'max-w-[95%] md:max-w-[85%] px-3.5 sm:px-4 py-3 bg-surface border border-border/80 text-text-primary rounded-tl-xs overflow-hidden text-sm md:text-base'
        )}
      >
        {/* Tool activity line (assistant only) */}
        {!isUser && toolCalls.length > 0 && (
          <div className="mb-2 pb-2 border-b border-border/50">
            <button
              type="button"
              onClick={() => setShowTools(!showTools)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
              aria-expanded={showTools}
            >
              <Wrench className="w-3.5 h-3.5 text-primary" />
              <span>أدوات استدعاء القرآن ({toolCalls.length})</span>
              {showTools ? (
                <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              )}
            </button>

            {showTools && (
              <div className="mt-2 space-y-1 text-xs text-text-secondary bg-background/50 rounded-lg p-2 border border-border/40 font-mono">
                {toolCalls.map((tc, idx) => (
                  <div key={idx} className="truncate">
                    <span className="font-semibold text-primary">{tc.name}</span>
                    <span className="text-[11px] text-text-muted ms-1.5">
                      {tc.argumentsJson}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Content */}
        {isUser ? (
          <div className="whitespace-pre-wrap select-text leading-relaxed tracking-normal py-0.5">
            {message.content}
          </div>
        ) : (
          <SanitizedMarkdown content={message.content} />
        )}

        {/* Proposals Cards (if any) */}
        {!isUser && allProposals.length > 0 && (
          <div className="mt-3 space-y-3">
            {allProposals.map((prop, idx) => (
              <ProposalCard key={prop.id || idx} proposal={prop} />
            ))}
          </div>
        )}

        {/* Action Bar (assistant only) */}
        {!isUser && (
          <MessageActionBar
            message={message}
            onCopy={() => {}}
            onAddToCollection={handleAddToCollection}
            onSaveAsConnection={handleSaveAsConnection}
            onSearchMore={() =>
              onSendFollowUp?.(
                `ابحث عن المزيد المتعلق بـ: ${message.content.substring(0, 60)}...`
              )
            }
            onBookmark={handleBookmark}
            isBookmarked={isBookmarked}
          />
        )}

        {/* Timestamp */}
        <div
          className={cn(
            'text-[10px] mt-1 select-none flex items-center',
            isUser ? 'text-white/80 justify-end' : 'text-text-muted justify-start'
          )}
        >
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
};
