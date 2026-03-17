// src/infrastructure/ai/openai.ts
import OpenAI from 'openai';
import { env } from '../../config/env';
import { IAIService, Role, ChatMessage, AIResponse, ToolCall } from '../../domain/entities';
import fs from 'fs';
import path from 'path';

export class OpenAIService implements IAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  private getTools(): OpenAI.Chat.ChatCompletionTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'gmail_search',
          description: 'Busca correos electrónicos en Gmail usando un query (ej. "from:ryanair in:inbox")',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query de búsqueda de Gmail' },
              max: { type: 'number', description: 'Número máximo de resultados', default: 10 }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gmail_send',
          description: 'Envía un correo electrónico',
          parameters: {
            type: 'object',
            properties: {
              to: { type: 'string', description: 'Destinatario' },
              subject: { type: 'string', description: 'Asunto' },
              body: { type: 'string', description: 'Cuerpo del mensaje' }
            },
            required: ['to', 'subject', 'body']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calendar_list_events',
          description: 'Lista eventos del calendario',
          parameters: {
            type: 'object',
            properties: {
              calendarId: { type: 'string', description: 'ID del calendario (por defecto primary)', default: 'primary' },
              from: { type: 'string', description: 'Fecha inicio ISO (ej. 2024-01-01T00:00:00Z)' },
              to: { type: 'string', description: 'Fecha fin ISO' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calendar_create_event',
          description: 'Crea un evento en el calendario',
          parameters: {
            type: 'object',
            properties: {
              calendarId: { type: 'string', description: 'ID del calendario', default: 'primary' },
              summary: { type: 'string', description: 'Título del evento' },
              from: { type: 'string', description: 'Fecha inicio ISO' },
              to: { type: 'string', description: 'Fecha fin ISO' }
            },
            required: ['summary', 'from', 'to']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'drive_search',
          description: 'Busca archivos en Google Drive',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Query de búsqueda' },
              max: { type: 'number', default: 10 }
            },
            required: ['query']
          }
        }
      }
    ];
  }

  async generateReply(messages: ChatMessage[]): Promise<AIResponse> {
    const response = await this.openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      messages: messages.map(msg => ({
        role: msg.role === 'tool' ? 'tool' : (msg.role === 'assistant' ? 'assistant' : (msg.role === 'system' ? 'system' : 'user')),
        content: msg.content,
        tool_calls: msg.toolCalls,
        tool_call_id: msg.toolCallId
      } as any)),
      tools: this.getTools(),
      tool_choice: 'auto'
    });

    const choice = response.choices[0];
    const message = choice.message;
    
    let toolCalls: ToolCall[] | undefined = undefined;
    
    if (message.tool_calls) {
      toolCalls = message.tool_calls
        .filter(tc => tc.type === 'function')
        .map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments
          }
        }));
    }
    
    return {
      content: message.content || null,
      toolCalls: toolCalls
    };
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const tempFilePath = path.join(__dirname, `../../../temp_audio_${Date.now()}.ogg`);
    
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      const fileStream = fs.createReadStream(tempFilePath);
      
      const response = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: env.OPENAI_TRANSCRIPTION_MODEL,
        language: 'es',
      });
      
      return response.text;
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  async extractMemories(text: string, currentMemories: string[]): Promise<string[]> {
    const prompt = `Analiza el texto del usuario y extrae información o preferencias clave a largo plazo. Ignora conversaciones casuales. Devuelve estrictamente un JSON Object con una clave "memories" que contenga un array de strings. Evita hechos repetidos.
    Recuerdos previos: ${currentMemories.join(', ') || 'Ninguno'}
    Texto: ${text}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      const data = JSON.parse(response.choices[0]?.message?.content || '{}');
      return data.memories || [];
    } catch (e) {
      console.error('Error Extracting Memories:', e);
      return [];
    }
  }

  async summarizeConversation(summary: string, newMessages: ChatMessage[]): Promise<string> {
    const chatText = newMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    const prompt = `Crea un resumen conciso consolidando el resumen anterior y los nuevos mensajes. Captura la intención general y eventos importantes.
    Resumen Anterior: ${summary || 'Sin resumen previo'}
    Nuevos Mensajes:
    ${chatText}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: env.OPENAI_CHAT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      });
      return response.choices[0]?.message?.content || summary;
    } catch (e) {
      console.error('Error Summarizing:', e);
      return summary;
    }
  }
}

export const aiService = new OpenAIService();
