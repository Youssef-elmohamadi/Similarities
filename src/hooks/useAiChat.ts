import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE_URL, getCachedAccessToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  saveChatConversationsToCache,
  getCachedChatConversations,
  deleteCachedChatConversation,
  saveChatMessagesToCache,
  getCachedChatMessages,
} from '@/offline/userDataDb';
import type {
  ChatStatus,
  ChatConversation,
  ChatMessage,
  SendMessageResponse,
  SimilarityProposal,
} from '@/types/chat';

export const CHAT_KEYS = {
  all: ['chat'] as const,
  status: () => [...CHAT_KEYS.all, 'status'] as const,
  conversations: (includeArchived: boolean) =>
    [...CHAT_KEYS.all, 'conversations', { includeArchived }] as const,
  messages: (conversationId: string) =>
    [...CHAT_KEYS.all, 'messages', conversationId] as const,
};

export function useChatStatus() {
  return useQuery<ChatStatus>({
    queryKey: CHAT_KEYS.status(),
    queryFn: async () => {
      const res = await api.get<ChatStatus>('/chat/status');
      return res.data;
    },
    networkMode: 'offlineFirst',
    staleTime: 60 * 1000,
  });
}

export function useChatConversations(includeArchived = false) {
  const { user } = useAuth();

  return useQuery<ChatConversation[]>({
    queryKey: CHAT_KEYS.conversations(includeArchived),
    queryFn: async (): Promise<ChatConversation[]> => {
      // 1. If known offline, read from IndexedDB
      if (typeof navigator !== 'undefined' && !navigator.onLine && user?.id) {
        const cached = await getCachedChatConversations(user.id);
        if (cached.length > 0) {
          return cached
            .filter((c) => Boolean(c && c.id))
            .map((c) => ({
              id: c.id,
              title: c.title || 'محادثة',
              summary: c.summary,
              isArchived: c.isArchived,
              messageCount: c.messageCount ?? 0,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            }));
        }
      }

      // 2. Fetch from server
      try {
        const res = await api.get<ChatConversation[]>('/chat/conversations', {
          params: { includeArchived },
        });
        const valid = (res.data || []).filter((c): c is ChatConversation => Boolean(c && c.id));
        if (user?.id) {
          saveChatConversationsToCache(user.id, valid);
        }
        return valid;
      } catch (err) {
        // Fallback to IndexedDB cache
        if (user?.id) {
          const cached = await getCachedChatConversations(user.id);
          if (cached.length > 0) {
            return cached
              .filter((c) => Boolean(c && c.id))
              .map((c) => ({
                id: c.id,
                title: c.title || 'محادثة',
                summary: c.summary,
                isArchived: c.isArchived,
                messageCount: c.messageCount ?? 0,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              }));
          }
        }
        throw err;
      }
    },
    networkMode: 'offlineFirst',
    staleTime: 30 * 1000,
  });
}

export function useChatMessages(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery<ChatMessage[]>({
    queryKey: CHAT_KEYS.messages(conversationId ?? ''),
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];

      // 1. If known offline, read from IndexedDB
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedChatMessages(conversationId);
        if (cached.length > 0) {
          return cached.map((m) => ({
            id: m.id,
            conversationId: m.conversationId,
            role: m.role,
            content: m.content,
            toolCallsJson: m.toolCallsJson,
            proposalsJson: m.proposalsJson,
            tokenCount: m.tokenCount,
            createdAt: m.createdAt,
          }));
        }
      }

      // 2. Fetch from server
      try {
        const res = await api.get<ChatMessage[]>(
          `/chat/conversations/${conversationId}/messages`
        );
        const valid = (res.data || []).filter((m): m is ChatMessage => Boolean(m && m.id));
        if (user?.id) {
          saveChatMessagesToCache(user.id, conversationId, valid);
        }
        return valid;
      } catch (err) {
        // Fallback to IndexedDB cache
        const cached = await getCachedChatMessages(conversationId);
        if (cached.length > 0) {
          return cached
            .filter((m) => Boolean(m && m.id))
            .map((m) => ({
              id: m.id,
              conversationId: m.conversationId,
              role: m.role,
              content: m.content,
              toolCallsJson: m.toolCallsJson,
              proposalsJson: m.proposalsJson,
              tokenCount: m.tokenCount,
              createdAt: m.createdAt,
            }));
        }
        throw err;
      }
    },
    enabled: Boolean(conversationId),
    networkMode: 'offlineFirst',
    staleTime: 60 * 1000,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (title?: string) => {
      const res = await api.post<ChatConversation>('/chat/conversations', { title });
      return res.data;
    },
    onSuccess: (newConv) => {
      queryClient.setQueryData<ChatConversation[]>(
        CHAT_KEYS.conversations(false),
        (old) => (old ? [newConv, ...old] : [newConv])
      );
      if (user?.id) {
        saveChatConversationsToCache(user.id, [newConv]);
      }
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      isArchived,
    }: {
      id: string;
      title?: string;
      isArchived?: boolean;
    }) => {
      const res = await api.patch<ChatConversation>(`/chat/conversations/${id}`, {
        title,
        isArchived,
      });
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<ChatConversation[]>(
        CHAT_KEYS.conversations(false),
        (old) => (old ? old.map((c) => (c.id === updated.id ? updated : c)) : [updated])
      );
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/chat/conversations/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<ChatConversation[]>(
        CHAT_KEYS.conversations(false),
        (old) => (old ? old.filter((c) => c.id !== deletedId) : [])
      );
      queryClient.removeQueries({ queryKey: CHAT_KEYS.messages(deletedId) });
      if (user?.id) {
        deleteCachedChatConversation(user.id, deletedId);
      }
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      signal,
      onDelta,
      onToolActivity,
    }: {
      conversationId: string;
      content: string;
      signal?: AbortSignal;
      onDelta?: (delta: string) => void;
      onToolActivity?: (msg: string) => void;
    }) => {
      const token = getCachedAccessToken();
      const url = `${API_BASE_URL}/chat/conversations/${conversationId}/messages`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.message || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('ReadableStream not supported');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'text-delta';
        let remainingToday = 20;

        while (true) {
          if (signal?.aborted) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.substring(5).trim();
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === 'tool-activity') {
                  onToolActivity?.(parsed.message || 'ينفذ أداة...');
                } else if (currentEvent === 'text-delta') {
                  onDelta?.(parsed.delta || '');
                } else if (currentEvent === 'done') {
                  remainingToday = parsed.remainingToday ?? 20;
                }
              } catch {
                // Ignore parse errors on individual SSE chunks
              }
            }
          }
        }

        // Fetch latest messages to ensure complete state
        const refetch = await api.get<ChatMessage[]>(
          `/chat/conversations/${conversationId}/messages`
        );
        const latestAssistant = refetch.data[refetch.data.length - 1];
        const latestUser = refetch.data[refetch.data.length - 2];

        if (user?.id) {
          saveChatMessagesToCache(user.id, conversationId, refetch.data);
        }

        return {
          userMessage: latestUser,
          assistantMessage: latestAssistant,
          remainingMessagesToday: remainingToday,
        } as SendMessageResponse;
      } catch (streamErr) {
        if (signal?.aborted) {
          throw new Error('تم إيقاف الرد.');
        }

        // Fallback to standard JSON POST
        const res = await api.post<SendMessageResponse>(
          `/chat/conversations/${conversationId}/messages`,
          { content }
        );

        if (user?.id && res.data) {
          saveChatMessagesToCache(user.id, conversationId, [
            res.data.userMessage,
            res.data.assistantMessage,
          ]);
        }

        return res.data;
      }
    },
    onMutate: async ({ conversationId, content }) => {
      const messagesKey = CHAT_KEYS.messages(conversationId);
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const previousMessages =
        queryClient.getQueryData<ChatMessage[]>(messagesKey) ?? [];

      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        tokenCount: 0,
      };

      queryClient.setQueryData<ChatMessage[]>(messagesKey, [
        ...previousMessages,
        optimisticMsg,
      ]);

      return { previousMessages, messagesKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages && context?.messagesKey) {
        queryClient.setQueryData(context.messagesKey, context.previousMessages);
      }
    },
    onSuccess: (data, variables) => {
      const messagesKey = CHAT_KEYS.messages(variables.conversationId);
      queryClient.setQueryData<ChatMessage[]>(messagesKey, (old) => {
        const validNew = [data?.userMessage, data?.assistantMessage].filter(
          (m): m is ChatMessage => Boolean(m && m.id)
        );
        if (!old) return validNew;
        const filtered = old.filter((m) => Boolean(m && m.id && !m.id.startsWith('optimistic-')));
        const existingIds = new Set(filtered.map((m) => m.id));
        const toAdd = validNew.filter((m) => !existingIds.has(m.id));
        return [...filtered, ...toAdd];
      });

      queryClient.setQueryData<ChatStatus>(CHAT_KEYS.status(), (old) => {
        if (!old) return old;
        return { ...old, remainingToday: data?.remainingMessagesToday ?? old.remainingToday };
      });

      queryClient.invalidateQueries({ queryKey: messagesKey });
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.conversations(false) });
    },
  });
}

export function useSaveProposalToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      newCollectionTitle,
      proposal,
    }: {
      collectionId?: string;
      newCollectionTitle?: string;
      proposal: SimilarityProposal;
    }) => {
      let targetCollectionId = collectionId;

      // 1. Create collection if not selecting existing
      if (!targetCollectionId) {
        const title = newCollectionTitle || proposal.title || 'مقارنة متشابهات مقترحة';
        const createRes = await api.post<{ id: string }>('/collections', {
          title,
          description: proposal.reason
            ? `سبب المقارنة: ${proposal.reason}`
            : proposal.description,
        });
        targetCollectionId = createRes.data.id;
      }

      // 2. Add each verse to the collection
      for (let i = 0; i < proposal.verses.length; i++) {
        const verse = proposal.verses[i];
        const note =
          i === 0 && proposal.differences
            ? `الفروق: ${proposal.differences}`
            : verse.note || proposal.note;
        try {
          await api.post(`/collections/${targetCollectionId}/verses`, {
            quranVerseId: verse.verseId,
            displayOrder: i + 1,
            personalNote: note,
          });
        } catch {
          // Continue adding remaining verses
        }
      }

      return targetCollectionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
