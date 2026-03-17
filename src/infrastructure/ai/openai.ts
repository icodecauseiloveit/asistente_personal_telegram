// src/infrastructure/ai/openai.ts
import OpenAI from 'openai';
import { env } from '../../config/env';
import { IAIService, Role, ChatMessage } from '../../domain/entities';
import fs from 'fs';
import path from 'path';

export class OpenAIService implements IAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  async generateReply(messages: { role: Role; content: string }[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      messages: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      })),
    });

    return response.choices[0]?.message?.content || 'Sin respuesta.';
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
