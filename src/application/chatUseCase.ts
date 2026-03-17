// src/application/chatUseCase.ts
import { IAIService, IChatRepository, ChatMessage, ToolCall } from '../domain/entities';
import { gogService } from '../infrastructure/google/gogService';

export class ChatUseCase {
  private readonly MAX_UNSUMMARIZED_MESSAGES = 15;
  private readonly MAX_TOOL_ITERATIONS = 5;

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
    await this.chatRepository.saveMessage({ userId, role: 'user', content: text });

    // 3. Extract explicit memories (Background)
    this.extractAndSaveMemoriesAsync(userId, text, memories.map(m => m.content));

    // 4. Construct System Prompt
    const systemPrompt = `Eres un asistente de IA personal.
Tus capacidades: Eres conversacional, servicial, conciso y eficiente.
Tienes acceso a herramientas de Google (Gmail, Calendario, Drive, Sheets, Contactos). Úsalas cuando el usuario te lo pida o sea necesario.
---
Memoria Permanente:
${memories.length > 0 ? memories.map(m => '- ' + m.content).join('\n') : 'Ninguna relevante todavía.'}
---
Resumen histórico: 
${summary ? summary.content : 'Sin historial resumido.'}
---
Responde usando el contexto y las herramientas disponibles.`;

    let iteration = 0;
    let lastReply = '';

    while (iteration < this.MAX_TOOL_ITERATIONS) {
      iteration++;
      
      // Fetch recent messages including recent tool interaction
      const recentMessages = await this.chatRepository.getUnsummarizedMessages(userId, lastSummaryId);
      
      const payload: ChatMessage[] = [
        { userId, role: 'system', content: systemPrompt },
        ...recentMessages
      ];

      const response = await this.aiService.generateReply(payload);

      // Save Assistant Reply (it might have toolCalls or content)
      await this.chatRepository.saveMessage({
        userId,
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        // Handle tool calls
        for (const toolCall of response.toolCalls) {
          const result = await this.executeTool(toolCall);
          
          // Save tool result
          await this.chatRepository.saveMessage({
            userId,
            role: 'tool',
            content: result,
            toolCallId: toolCall.id
          });
        }
        // Continue loop to let AI process tool results
        continue;
      }

      // If no tool calls, this is the final reply
      lastReply = response.content || 'No pude generar una respuesta.';
      break;
    }

    // Manage Summary Threshold (Background)
    const finalRecentMessages = await this.chatRepository.getUnsummarizedMessages(userId, lastSummaryId);
    if (finalRecentMessages.length >= this.MAX_UNSUMMARIZED_MESSAGES) {
      this.summarizeAndSaveAsync(userId, summary?.content || '', finalRecentMessages);
    }

    return lastReply;
  }

  private async executeTool(toolCall: ToolCall): Promise<string> {
    const { name, arguments: argsString } = toolCall.function;
    const args = JSON.parse(argsString);
    
    console.log(`[ChatUseCase] Executing tool: ${name}`, args);

    try {
      switch (name) {
        case 'gmail_search':
          return await gogService.gmailSearch(args.query, args.max);
        case 'gmail_send':
          return await gogService.gmailSend(args.to, args.subject, args.body);
        case 'calendar_list_events':
          return await gogService.calendarListEvents(args.calendarId, args.from, args.to);
        case 'calendar_create_event':
          return await gogService.calendarCreateEvent(args.calendarId, args.summary, args.from, args.to);
        case 'drive_search':
          return await gogService.driveSearch(args.query, args.max);
        default:
          return `Error: Herramienta ${name} no encontrada.`;
      }
    } catch (error: any) {
      console.error(`[ChatUseCase] Tool execution error (${name}):`, error);
      return `Error ejecutando ${name}: ${error.message}`;
    }
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

  private async summarizeAndSaveAsync(userId: number, currentSummaryStr: string, messagesToSummarize: ChatMessage[]) {
    try {
      const newSummaryStr = await this.aiService.summarizeConversation(currentSummaryStr, messagesToSummarize);
      const lastMsgId = messagesToSummarize[messagesToSummarize.length - 1].id || 0;
      await this.chatRepository.saveSummary(userId, newSummaryStr, lastMsgId);
      console.log(`[Summary] Conversation compacted up to Message ID ${lastMsgId} for User ${userId}`);
    } catch (e) {
      console.error('[Summary] Error executing background summarizer', e);
    }
  }
}
