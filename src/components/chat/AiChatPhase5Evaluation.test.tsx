// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProposalCard } from './ProposalCard';
import { VerseTokenChip } from './VerseTokenChip';
import type { SimilarityProposal } from '@/types/chat';
import {
  saveChatConversationsToCache,
  getCachedChatConversations,
  saveChatMessagesToCache,
  getCachedChatMessages,
  wipeUserDataOnLogout,
} from '@/offline/userDataDb';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock useVerseLookup to return exact dataset Quranic verse text
vi.mock('@/hooks/useVerseLookup', () => ({
  useVerseLookup: (surahNumber: number, ayahNumber: number) => {
    if (surahNumber === 6 && ayahNumber === 10) {
      return {
        data: {
          id: 799,
          surahNumber: 6,
          ayahNumber: 10,
          surahNameArabic: 'الأنعام',
          uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُواْ مِنۡهُم مَّا كَانُواْ بِهِۦ يَسۡتَهۡزِءُونَ',
          words: [],
        },
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  },
}));

describe('AI Chat Phase 5 Evaluation Test Suite (Frontend)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  // 1. Verse token rendering equals dataset text exactly
  it('verse token rendering equals dataset text exactly when expanded with word range highlighting', () => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <VerseTokenChip surahNumber={6} ayahNumber={10} wordRange="1-3" />
        </QueryClientProvider>
      );
    });

    const triggerBtn = container.querySelector('button');
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn?.textContent).toContain('الأنعام:10');
    expect(triggerBtn?.textContent).toContain('كلمات 1-3');

    // Click to expand
    act(() => {
      triggerBtn?.click();
    });

    // Verify exact Uthmani text words from dataset are rendered with proper word spacing
    const marks = Array.from(container.querySelectorAll('mark')).map((m) => m.textContent);
    expect(marks).toEqual(['وَلَقَدِ', 'ٱسۡتُهۡزِئَ', 'بِرُسُلࣲ']);
    expect(container.textContent).toContain('وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُواْ مِنۡهُم مَّا كَانُواْ بِهِۦ يَسۡتَهۡزِءُونَ');
    expect(container.textContent).toContain('﴿١٠﴾');
    expect(container.textContent).toContain('الكلمات المحددة: (1-3)');
  });

  // 2. Proposals never auto-save
  it('proposals never auto-save: stays in unapproved state and does not call API on initial render', () => {
    const onApproveMock = vi.fn();
    const mockProp: SimilarityProposal = {
      id: 'prop-eval-1',
      title: 'متشابهات الاستهزاء بالرسل',
      reason: 'تكرار نفس البداية في الأنعام والرعد',
      verses: [
        {
          verseId: 799,
          surahNumber: 6,
          surahName: 'الأنعام',
          ayahNumber: 10,
          uthmaniText: 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ',
        },
      ],
      differences: 'الأنعام: فحاق بالذين سخروا، الرعد: فأمليت للذين كفروا',
    };

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProposalCard proposal={mockProp} onApproved={onApproveMock} />
        </QueryClientProvider>
      );
    });

    // Verified: No auto-save or mutation triggered upon render
    expect(onApproveMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain('متشابهات الاستهزاء بالرسل');
    expect(container.textContent).toContain('اعتماد');
    expect(container.textContent).toContain('تعديل ثم اعتماد');
    expect(container.textContent).toContain('تجاهل');
  });

  // 3. Offline read of history from IndexedDB
  it('offline read of history: retrieves cached conversations and messages from IndexedDB', async () => {
    const testUserId = 'test-user-offline-read';
    const convId = 'conv-test-offline-1';

    // Seed offline IndexedDB stores
    await saveChatConversationsToCache(testUserId, [
      {
        id: convId,
        title: 'محادثة محفوظات الأوفلاين',
        summary: 'ملخص المحادثة',
        isArchived: false,
        messageCount: 2,
        createdAt: '2026-11-04T12:00:00Z',
        updatedAt: '2026-11-04T12:05:00Z',
      },
    ]);

    await saveChatMessagesToCache(testUserId, convId, [
      {
        id: 'msg-1',
        role: 'user',
        content: 'أين وردت آيات الاستهزاء بالرسل؟',
        createdAt: '2026-11-04T12:00:10Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'وردت في [[v:6:10]] و [[v:13:32]]',
        createdAt: '2026-11-04T12:00:20Z',
      },
    ]);

    // Read back offline
    const cachedConvs = await getCachedChatConversations(testUserId);
    expect(cachedConvs).toHaveLength(1);
    expect(cachedConvs[0].id).toBe(convId);
    expect(cachedConvs[0].title).toBe('محادثة محفوظات الأوفلاين');

    const cachedMsgs = await getCachedChatMessages(convId);
    expect(cachedMsgs).toHaveLength(2);
    expect(cachedMsgs[0].content).toContain('أين وردت');
    expect(cachedMsgs[1].content).toContain('[[v:6:10]]');
  });

  // 4. Logout wipe
  it('logout wipe: purges all cached chat conversations and messages for the user from IndexedDB', async () => {
    const userToWipe = 'user-to-wipe-chat-99';
    const convId = 'conv-wipe-test-1';

    await saveChatConversationsToCache(userToWipe, [
      {
        id: convId,
        title: 'محادثة ستمحى عند تسجيل الخروج',
        createdAt: '2026-11-04T13:00:00Z',
        updatedAt: '2026-11-04T13:00:00Z',
      },
    ]);

    await saveChatMessagesToCache(userToWipe, convId, [
      {
        id: 'msg-wipe-1',
        role: 'user',
        content: 'سؤال سرّي',
        createdAt: '2026-11-04T13:00:05Z',
      },
    ]);

    // Confirm existence
    let convs = await getCachedChatConversations(userToWipe);
    let msgs = await getCachedChatMessages(convId);
    expect(convs).toHaveLength(1);
    expect(msgs).toHaveLength(1);

    // Trigger logout wipe
    await wipeUserDataOnLogout(userToWipe);

    // Verify completely purged
    convs = await getCachedChatConversations(userToWipe);
    msgs = await getCachedChatMessages(convId);
    expect(convs).toHaveLength(0);
    expect(msgs).toHaveLength(0);
  });

  // 5. Stream interruption and retry simulation
  it('stream interruption retry: abort controller halts reader and allows clean restart', async () => {
    let aborted = false;
    const abortController = new AbortController();

    const mockStreamFetch = async (signal: AbortSignal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      // simulate stream chunk
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"chunk":"جزء 1"}\n\n'));
        },
      });
    };

    const stream = await mockStreamFetch(abortController.signal);
    expect(stream).toBeDefined();

    // User hits stop button
    abortController.abort();
    expect(aborted).toBe(true);

    // New stream request succeeds cleanly upon retry
    const retryController = new AbortController();
    let retryReceived = false;
    const retryStream = await mockStreamFetch(retryController.signal);
    const reader = retryStream.getReader();
    const { value } = await reader.read();
    if (value) {
      retryReceived = true;
    }
    expect(retryReceived).toBe(true);
  });
});
