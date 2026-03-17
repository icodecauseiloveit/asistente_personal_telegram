// src/domain/entities.ts

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  id?: number;
  userId: number;
  role: Role;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  createdAt?: string;
}

export interface ChatSummary {
  id?: number;
  userId: number;
  content: string;
  lastMessageId: number;
  createdAt?: string;
}

export interface Memory {
  id?: number;
  userId: number;
  content: string;
  createdAt?: string;
}

export interface IChatRepository {
  // Messages
  getChatHistory(userId: number, limit?: number): Promise<ChatMessage[]>;
  getUnsummarizedMessages(userId: number, lastSummarizedId: number): Promise<ChatMessage[]>;
  saveMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<number>;
  clearHistory(userId: number): Promise<void>;
  
  // Summaries
  getLatestSummary(userId: number): Promise<ChatSummary | null>;
  saveSummary(userId: number, content: string, lastMessageId: number): Promise<void>;
  
  // Memories
  getMemories(userId: number): Promise<Memory[]>;
  saveMemory(userId: number, content: string): Promise<void>;
  clearMemories(userId: number): Promise<void>;
}

export interface AIResponse {
  content: string | null;
  toolCalls?: ToolCall[];
}

export interface IAIService {
  generateReply(messages: ChatMessage[]): Promise<AIResponse>;
  transcribeAudio(audioBuffer: Buffer): Promise<string>;
  extractMemories(text: string, currentMemories: string[]): Promise<string[]>;
  summarizeConversation(summary: string, newMessages: ChatMessage[]): Promise<string>;
}
