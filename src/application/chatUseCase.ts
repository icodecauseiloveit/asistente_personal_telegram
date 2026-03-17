// src/application/chatUseCase.ts
import { IAIService, IChatRepository } from '../domain/entities';

export class ChatUseCase {
  private readonly MAX_UNSUMMARIZED_MESSAGES = 15;

  constructor(
    private readonly chatRepository: IChatRepository,
    private readonly aiService: IAIService
  ) {}

  async processTextMessage(userId: number, text: string): Promise<string> {
    // 1. Fetch persistent User memories and summary
    const memories = await this.chatRepository.getMemories(userId);
    const summary = await this.chatRepository.getLatestSummary(userId);
    const lastSummaryId = summary?.lastMessageId || 0;

    // 2. Save User Message
    const userMessageId = await this.chatRepository.saveMessage(userId, 'user', text);

    // 3. Fetch unsummarized recent context (so OpenAI remembers immediately surrounding messages)
    const recentMessages = await this.chatRepository.getUnsummarizedMessages(userId, lastSummaryId);

    // 4. Extract explicit memories (Fire and Forget) to keep it fast
    this.extractAndSaveMemoriesAsync(userId, text, memories.map(m => m.content));

    // 5. Construct AI Prompt injected with context
    const systemPrompt = `Eres un asistente de IA personal.
Tus capacidades: Eres conversacional, servicial, conciso y eficiente.
---
Memoria Permanente que conoces del usuario:
${memories.length > 0 ? memories.map(m => '- ' + m.content).join('\n') : 'Ninguna relevante todavía.'}
---
Resumen del contexto pasados de esta conversación: 
${summary ? summary.content : 'Sin historial resumido.'}
---
Responde al último mensaje usando el contexto provisto y los recuerdos del usuario de la mejor forma útil.`;

    const payload = [
      { role: 'system' as const, content: systemPrompt },
      ...recentMessages.map(msg => ({ role: msg.role, content: msg.content }))
    ];

    // 6. Generate Reply
    const reply = await this.aiService.generateReply(payload);
    
    // 7. Save Assistant Reply
    const assistantMessageId = await this.chatRepository.saveMessage(userId, 'assistant', reply);

    // 8. Manage Summary Threshold (Fire and Forget)
    if (recentMessages.length >= this.MAX_UNSUMMARIZED_MESSAGES) {
      this.summarizeAndSaveAsync(userId, summary?.content || '', [...recentMessages, { userId, role: 'assistant', content: reply, id: assistantMessageId }]);
    }

    return reply;
  }

  async processVoiceMessage(userId: number, audioBuffer: Buffer): Promise<string> {
    const text = await this.aiService.transcribeAudio(audioBuffer);
    return this.processTextMessage(userId, text);
  }

  async clearHistory(userId: number): Promise<void> {
    await this.chatRepository.clearHistory(userId);
  }

  async getMemoriesString(userId: number): Promise<string> {
    const memories = await this.chatRepository.getMemories(userId);
    if (memories.length === 0) return 'No tengo recuerdos guardados tuyos aún.';
    return 'Mis recuerdos de ti:\n' + memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
  }

  async clearMemories(userId: number): Promise<void> {
    await this.chatRepository.clearMemories(userId);
  }

  // --- Background Tasks ---
  private async extractAndSaveMemoriesAsync(userId: number, text: string, currentMemories: string[]) {
    try {
      const newMemories = await this.aiService.extractMemories(text, currentMemories);
      for (const mem of newMemories) {
        await this.chatRepository.saveMemory(userId, mem);
        console.log(`[Memory] Saved new memory for User ${userId}: ${mem}`);
      }
    } catch (e) {
      console.error('[Memory] Error executing background memory thread', e);
    }
  }

  private async summarizeAndSaveAsync(userId: number, currentSummaryStr: string, messagesToSummarize: any[]) {
    try {
      const newSummaryStr = await this.aiService.summarizeConversation(currentSummaryStr, messagesToSummarize);
      const lastMsgId = messagesToSummarize[messagesToSummarize.length - 1].id;
      await this.chatRepository.saveSummary(userId, newSummaryStr, lastMsgId);
      console.log(`[Summary] Conversation compacted up to Message ID ${lastMsgId} for User ${userId}`);
    } catch (e) {
      console.error('[Summary] Error executing background summarizer', e);
    }
  }
}
