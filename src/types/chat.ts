export interface ChatStatus {
  enabled: boolean;
  provider: string;
  model: string;
  keyConfigured: boolean;
  remainingToday: number;
  dailyLimit: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  messageCount: number;
}

export interface ProposalVerseItem {
  verseId: number;
  surahNumber: number;
  surahName: string;
  ayahNumber: number;
  uthmaniText: string;
  note?: string;
}

export interface SimilarityProposal {
  id: string;
  type?: 'comparison' | 'collection' | 'connection';
  title: string;
  reason?: string;
  description?: string;
  verses: ProposalVerseItem[];
  differences?: string;
  note?: string;
  sourceVerse?: ProposalVerseItem;
  targetVerse?: ProposalVerseItem;
  connectionType?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCallsJson?: string;
  proposalsJson?: string;
  createdAt: string;
  tokenCount: number;
}

export interface SendMessageResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  remainingMessagesToday: number;
}

export interface ChatSearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  role: string;
  content: string;
  createdAt: string;
}
