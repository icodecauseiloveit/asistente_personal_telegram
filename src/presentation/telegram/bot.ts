// src/presentation/telegram/bot.ts
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from '../../config/env';
import { ChatUseCase } from '../../application/chatUseCase';

export class TelegramBot {
  private bot: Telegraf;

  constructor(private readonly chatUseCase: ChatUseCase) {
    this.bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
    this.setupMiddleware();
    this.setupHandlers();
  }

  private setupMiddleware() {
    this.bot.use(async (ctx, next) => {
      const isAllowed = env.TELEGRAM_ALLOWED_USER_IDS.length === 0; // If empty, allow all.
      const userId = ctx.from?.id;
      
      if (!isAllowed && userId && !env.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        await ctx.reply('No tienes autorización para usar este bot. Por favor, contacta al administrador.');
        return;
      }
      return next();
    });
  }

  private setupHandlers() {
    this.bot.start(async (ctx) => {
      await this.chatUseCase.clearHistory(ctx.message.from.id);
      await ctx.reply('¡Hola! Soy tu Asistente Personal de Inteligencia Artificial.\n\nHe borrado cualquier historial temporal previo pero retendré la memoria de tus preferencias si me lo pides.\nEscribe /help para más comandos.');
    });

    this.bot.command('help', async (ctx) => {
      const helpText = `Comandos Disponibles:
/start - Iniciar bot y borrar sesión actual
/help - Mostrar este menú
/status - Ver estado y modelos configurados
/memory - Leer mis recuerdos aprendidos a largo plazo
/clear - Borrar historial reciente y todos mis recuerdos de ti`;
      await ctx.reply(helpText);
    });

    this.bot.command('status', async (ctx) => {
      await ctx.reply(`Estado: Activo\nChat: ${env.OPENAI_CHAT_MODEL}\nAudio: ${env.OPENAI_TRANSCRIPTION_MODEL}`);
    });

    this.bot.command('memory', async (ctx) => {
      const memories = await this.chatUseCase.getMemoriesString(ctx.message.from.id);
      await ctx.reply(memories);
    });

    this.bot.command('clear', async (ctx) => {
      const userId = ctx.message.from.id;
      await this.chatUseCase.clearHistory(userId);
      await this.chatUseCase.clearMemories(userId);
      await ctx.reply('Memoria e historial limpiados exitosamente.');
    });

    this.bot.on(message('text'), async (ctx) => {
      const text = ctx.message.text;
      const userId = ctx.message.from.id;
      
      try {
        await ctx.sendChatAction('typing');
        const reply = await this.chatUseCase.processTextMessage(userId, text);
        await ctx.reply(reply);
      } catch (error) {
        console.error('Error processing text:', error);
        await ctx.reply('Lo siento, el modelo no pudo generar una respuesta.');
      }
    });

    this.bot.on(message('voice'), async (ctx) => {
      const userId = ctx.message.from.id;
      const fileId = ctx.message.voice.file_id;

      try {
        await ctx.sendChatAction('record_voice');
        const fileLink = await ctx.telegram.getFileLink(fileId);
        
        const response = await fetch(fileLink.toString());
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await ctx.sendChatAction('typing');
        const reply = await this.chatUseCase.processVoiceMessage(userId, buffer);
        await ctx.reply(reply);
      } catch (error) {
        console.error('Error processing voice:', error);
        await ctx.reply('Lo siento, hubo un error transcribiendo el audio.');
      }
    });
  }

  public launch() {
    this.bot.launch();
    console.log('Telegram bot is running...');

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}
