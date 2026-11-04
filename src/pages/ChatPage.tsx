import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  useChatStatus,
  useChatConversations,
  useChatMessages,
  useCreateConversation,
  useUpdateConversation,
  useDeleteConversation,
  useSendMessage,
} from '@/hooks/useAiChat';
import { ChatDisclaimers } from '@/components/chat/ChatDisclaimers';
import { ChatConversationList } from '@/components/chat/ChatConversationList';
import { ChatMessageItem } from '@/components/chat/ChatMessageItem';
import {
  Send,
  Loader2,
  Sparkles,
  WifiOff,
  Menu,
  Square,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

const STARTER_PROMPTS = [
  'ابحث عن آيات فيها استهزئ برسل من قبلك',
  'ما الفرق بين {ألم تر} و{ألم تر إلى} في القرآن الكريم؟',
  'استخرج الآيات المتشابهة في قصة موسى عليه السلام مع فرعون',
  'اقترح مقارنة لمواضع {وما كان الله ليعذبهم} مع الفروق',
];

export const ChatPage: React.FC = () => {
  const { data: status, isLoading: isStatusLoading } = useChatStatus();
  const { data: conversations = [], isLoading: isConvsLoading } = useChatConversations();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [inputContent, setInputContent] = useState('');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [activeToolActivity, setActiveToolActivity] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Pagination / Infinite scroll up state (visible window of messages)
  const [visibleCount, setVisibleCount] = useState(30);

  const { data: allMessages = [], isLoading: isMessagesLoading } = useChatMessages(activeConvId);
  const createMutation = useCreateConversation();
  const updateMutation = useUpdateConversation();
  const deleteMutation = useDeleteConversation();
  const sendMutation = useSendMessage();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Connectivity listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Set first conversation as active if none selected
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Reset visible count on conversation switch
  useEffect(() => {
    setVisibleCount(30);
    setStreamingDelta('');
    setActiveToolActivity(null);
    setLastFailedMessage(null);
  }, [activeConvId]);

  // Scroll to bottom on new message or during streaming
  useEffect(() => {
    if (sendMutation.isPending || streamingDelta) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages.length, sendMutation.isPending, streamingDelta]);

  // Infinite scroll up handler
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 40 && visibleCount < allMessages.length) {
      const prevScrollHeight = container.scrollHeight;
      setVisibleCount((prev) => Math.min(prev + 20, allMessages.length));

      // Maintain scroll position after prepending older messages
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    }
  }, [visibleCount, allMessages.length]);

  const handleNewConversation = async () => {
    try {
      const newConv = await createMutation.mutateAsync('محادثة جديدة');
      setActiveConvId(newConv.id);
      setIsMobileDrawerOpen(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch {
      // Handled
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateMutation.mutateAsync({ id, title: newTitle });
    } catch {
      // Handled
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    if (activeConvId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSend = async (contentToSend?: string) => {
    const text = (contentToSend || inputContent).trim();
    if (!text || sendMutation.isPending || !isOnline) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      const newConv = await createMutation.mutateAsync('محادثة جديدة');
      targetConvId = newConv.id;
      setActiveConvId(newConv.id);
    }

    setInputContent('');
    setStreamingDelta('');
    setActiveToolActivity(null);
    setLastFailedMessage(null);

    // Abort controller for Stop button
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await sendMutation.mutateAsync({
        conversationId: targetConvId,
        content: text,
        signal: controller.signal,
        onDelta: (delta) => setStreamingDelta((prev) => prev + delta),
        onToolActivity: (msg) => setActiveToolActivity(msg),
      });
    } catch (err: any) {
      if (err?.message !== 'تم إيقاف الرد.') {
        setLastFailedMessage(text);
      }
    } finally {
      setStreamingDelta('');
      setActiveToolActivity(null);
      abortControllerRef.current = null;
      textareaRef.current?.focus();
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // If status is disabled by backend config
  if (!isStatusLoading && status && !status.enabled) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-text-primary">
          المساعد القرآني الذكي (تجريبي)
        </h1>
        <div className="p-4 rounded-xl border border-border bg-surface text-sm text-text-secondary max-w-md mx-auto space-y-2">
          <p>
            الميزة معطلة حالياً في بيئة العمل. يمكنك تفعيلها وضبط مزود الخدمة من خلال ملف الإعدادات
            في الخادم (<code className="text-primary font-mono text-xs">AiChat:Enabled</code>).
          </p>
          <div className="text-xs text-text-muted">
            راجع دليل تهيئة الإنتاج في التوثيق للمزيد من التفاصيل.
          </div>
        </div>
      </div>
    );
  }

  const remainingMessages = status?.remainingToday ?? 20;
  const isQuotaExceeded = remainingMessages <= 0;

  // Window of visible messages for infinite scroll up
  const visibleMessages = allMessages.slice(-visibleCount);
  const hasMoreMessages = visibleCount < allMessages.length;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden min-h-0">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary p-1.5 rounded-lg border border-border bg-background"
          aria-label="عرض المحادثات السابقة"
        >
          <Menu className="w-4 h-4" />
          <span>المحادثات ({conversations.length})</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-primary font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>المساعد الذكي</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-normal">
            تجريبي
          </span>
        </div>

        <span className="text-[11px] text-text-muted px-2 py-0.5 rounded-full bg-background border border-border">
          المتبقي: {remainingMessages}
        </span>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile Drawer Backdrop */}
        {isMobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-charcoal-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Conversation List (Bottom sheet / Drawer on mobile, sidebar on desktop) */}
        <div
          className={cn(
            'w-72 md:w-80 shrink-0 h-full z-50 md:z-0 transition-transform duration-300 ease-out',
            'fixed md:static inset-y-0 start-0 bg-surface shadow-2xl md:shadow-none',
            isMobileDrawerOpen
              ? 'translate-x-0'
              : '-translate-x-full md:translate-x-0 rtl:translate-x-full rtl:md:translate-x-0'
          )}
        >
          {/* Mobile drawer close button */}
          <div className="md:hidden flex items-center justify-between p-3 border-b border-border">
            <span className="text-xs font-bold text-text-primary">قائمة المحادثات</span>
            <button
              onClick={() => setIsMobileDrawerOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ChatConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={(id) => {
              setActiveConvId(id);
              setIsMobileDrawerOpen(false);
            }}
            onNew={handleNewConversation}
            onRename={handleRenameConversation}
            onDelete={handleDeleteConversation}
            isLoading={isConvsLoading}
          />
        </div>

        {/* Chat Thread Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-background h-full overflow-hidden">
          {/* Header Permanent Disclaimers */}
          <div className="px-3 sm:px-4 py-1.5 shrink-0 bg-surface/60 border-b border-border/70">
            <ChatDisclaimers compact={true} />
          </div>

          {/* Messages Area (with Infinite scroll up) */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1 min-h-0"
          >
            {hasMoreMessages && (
              <div className="text-center py-2">
                <span className="text-xs text-text-muted">
                  اسحب للأعلى لتحميل المحادثات السابقة...
                </span>
              </div>
            )}

            {isMessagesLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : allMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto p-6 space-y-4 text-text-secondary">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-base md:text-lg mb-1">
                    أهلاً بك في مساعد المتشابهات القرآنية
                  </h3>
                  <p className="text-xs md:text-sm text-text-muted leading-relaxed">
                    مساعد بحثي تجريبي يستحضر الآيات بالرسم العثماني ويقارن الفروق اللفظية
                    بدقة وموضوعية. اختر من النماذج التالية أو اكتب سؤالك:
                  </p>
                </div>

                {/* 4 Starter Prompts */}
                <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-start text-xs pt-2">
                  {STARTER_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(prompt)}
                      className="p-3 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition text-text-primary text-start leading-snug cursor-pointer shadow-2xs"
                    >
                      «{prompt}»
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {visibleMessages.map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}

                {/* Live streaming bubble & Tool activity */}
                {sendMutation.isPending && (
                  <div className="space-y-2 my-2" aria-live="polite">
                    {/* Small muted tool activity line */}
                    {activeToolActivity && (
                      <div className="flex items-center gap-2 text-xs text-text-muted py-1 px-3 bg-surface/50 rounded-lg border border-border/60 w-fit">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        <span>{activeToolActivity}</span>
                      </div>
                    )}

                    {/* Streaming Text Delta */}
                    {streamingDelta ? (
                      <div className="flex gap-2.5 my-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="bg-surface border border-border text-text-primary rounded-2xl rounded-ts-xs px-4 py-3 text-sm md:text-base leading-relaxed whitespace-pre-wrap select-text max-w-[85%] shadow-2xs">
                          {streamingDelta}
                        </div>
                      </div>
                    ) : !activeToolActivity ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted py-2 px-1">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>المساعد يستحضر محرك البحث القرآني...</span>
                      </div>
                    ) : null}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Error Banner with Retry button */}
          {(sendMutation.isError || lastFailedMessage) && (
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {sendMutation.error instanceof Error
                    ? sendMutation.error.message
                    : 'انقطع اتصال البث، يرجى إعادة المحاولة.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {lastFailedMessage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSend(lastFailedMessage)}
                    className="h-7 text-xs border-red-400 text-red-600 hover:bg-red-500/10 gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>إعادة المحاولة</span>
                  </Button>
                )}
                <button
                  onClick={() => {
                    sendMutation.reset();
                    setLastFailedMessage(null);
                  }}
                  className="text-text-muted hover:text-text-primary font-medium"
                >
                  تجاهل
                </button>
              </div>
            </div>
          )}

          {/* Chat Composer / Input Bar */}
          <div className="p-3 md:p-4 bg-surface border-t border-border shrink-0 space-y-2">
            {/* Meta indicator bar */}
            <div className="flex items-center justify-between text-[11px] text-text-muted px-1">
              <div className="flex items-center gap-2">
                {!isOnline ? (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>غير متصل - يمكنك تصفح المحادثات السابقة محلياً</span>
                  </span>
                ) : (
                  <span className="text-text-muted hidden sm:inline">
                    اضغط Enter للإرسال، Shift + Enter لسطر جديد
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'font-medium',
                  isQuotaExceeded ? 'text-red-500 font-bold' : 'text-text-muted'
                )}
              >
                {isQuotaExceeded
                  ? 'تم استهلاك رصيد اليوم بالكامل'
                  : `الرصيد المتبقي: ${remainingMessages} رسائل اليوم`}
              </span>
            </div>

            {/* Input Form with Multi-line textarea and Stop Streaming button */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={textareaRef}
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isOnline
                    ? 'أنت في وضع غير متصل...'
                    : isQuotaExceeded
                    ? 'لقد استهلكت رصيدك اليومي من الرسائل'
                    : 'اكتب سؤالك حول المتشابهات اللفظية والآيات هنا...'
                }
                disabled={!isOnline || isQuotaExceeded || sendMutation.isPending}
                rows={2}
                className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2 text-xs md:text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 transition leading-relaxed min-h-[44px] max-h-36"
              />

              {sendMutation.isPending ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleStopStreaming}
                  className="h-10 px-3.5 rounded-xl shrink-0 gap-1.5 border-red-500/30 text-red-600 hover:bg-red-500/10"
                  title="إيقاف الرد"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span className="text-xs font-semibold">إيقاف</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={
                    !inputContent.trim() || !isOnline || isQuotaExceeded || sendMutation.isPending
                  }
                  className="h-10 px-4 rounded-xl shrink-0 gap-1.5"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                  <span className="hidden sm:inline">إرسال</span>
                </Button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
