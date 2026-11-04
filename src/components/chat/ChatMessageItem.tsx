import React, { useState } from 'react';
import type { ChatMessage, SimilarityProposal } from '@/types/chat';
import { ProposalCard } from './ProposalCard';
import { SanitizedMarkdown } from './SanitizedMarkdown';
import { Bot, User, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageItemProps {
  message: ChatMessage;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [showTools, setShowTools] = useState(false);

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
          'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs select-none',
          isUser
            ? 'bg-primary text-white'
            : 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble Content */}
      <div
        className={cn(
          'max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed shadow-2xs',
          isUser
            ? 'bg-primary text-white rounded-te-xs'
            : 'bg-surface border border-border text-text-primary rounded-ts-xs'
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

        {/* Message Content: Sanitized Markdown with [[v:...]] VerseText integration */}
        {isUser ? (
          <div className="whitespace-pre-wrap select-text leading-relaxed">
            {message.content}
          </div>
        ) : (
          <SanitizedMarkdown content={message.content} />
        )}

        {/* Proposals Cards (if any) */}
        {!isUser && proposals.length > 0 && (
          <div className="mt-3 space-y-3">
            {proposals.map((prop, idx) => (
              <ProposalCard key={prop.id || idx} proposal={prop} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={cn(
            'text-[10px] mt-1.5 select-none',
            isUser ? 'text-white/75 text-end' : 'text-text-muted text-start'
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
};
