// src/config/env.ts
import dotenv from 'dotenv';

dotenv.config();

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const env = {
  TELEGRAM_BOT_TOKEN: getEnvVar('TELEGRAM_BOT_TOKEN'),
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1',
  TELEGRAM_ALLOWED_USER_IDS: (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id)),
  DATABASE_URL: process.env.DATABASE_URL || './database.sqlite',
  GOG_ACCOUNT: process.env.GOG_ACCOUNT || '',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
