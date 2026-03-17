// src/index.ts
import { TelegramBot } from './presentation/telegram/bot';
import { ChatUseCase } from './application/chatUseCase';
import { chatRepository } from './infrastructure/db/sqlite';
import { aiService } from './infrastructure/ai/openai';

async function bootstrap() {
  try {
    // Initialize Database
    await chatRepository.init();
    console.log('Database initialized.');

    // Initialize Use Cases
    const chatUseCase = new ChatUseCase(chatRepository, aiService);

    // Initialize and launch Bot
    const bot = new TelegramBot(chatUseCase);
    bot.launch();

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
