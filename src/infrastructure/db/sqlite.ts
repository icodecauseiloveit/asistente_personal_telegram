// src/infrastructure/db/sqlite.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { ChatMessage, ChatSummary, Memory, IChatRepository, Role } from '../../domain/entities';

export class SqliteChatRepository implements IChatRepository {
  private db!: Database.Database;

  async init(): Promise<void> {
    const dbPath = path.resolve(env.DATABASE_URL);
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    // Messages Table (Added toolCalls and toolCallId)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        toolCalls TEXT,
        toolCallId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Summaries Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        content TEXT NOT NULL,
        lastMessageId INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Memories Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages (userId);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_summaries_userId ON summaries (userId);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_memories_userId ON memories (userId);`);
  }

  // --- Messages ---
  async getChatHistory(userId: number, limit: number = 30): Promise<ChatMessage[]> {
    const stmt = this.db.prepare(`SELECT * FROM messages WHERE userId = ? ORDER BY id DESC LIMIT ?`);
    const rows = stmt.all(userId, limit) as any[];
    return rows.reverse().map(row => ({
      ...row,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined
    }));
  }

  async getUnsummarizedMessages(userId: number, lastSummarizedId: number): Promise<ChatMessage[]> {
    const stmt = this.db.prepare(`SELECT * FROM messages WHERE userId = ? AND id > ? ORDER BY id ASC`);
    const rows = stmt.all(userId, lastSummarizedId) as any[];
    return rows.map(row => ({
      ...row,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined
    }));
  }

  async saveMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO messages (userId, role, content, toolCalls, toolCallId) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      message.userId, 
      message.role, 
      message.content, 
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolCallId || null
    );
    return info.lastInsertRowid as number;
  }

  async clearHistory(userId: number): Promise<void> {
    const deleteMessages = this.db.prepare(`DELETE FROM messages WHERE userId = ?`);
    const deleteSummaries = this.db.prepare(`DELETE FROM summaries WHERE userId = ?`);
    
    const transaction = this.db.transaction(() => {
      deleteMessages.run(userId);
      deleteSummaries.run(userId);
    });
    transaction();
  }

  // --- Summaries ---
  async getLatestSummary(userId: number): Promise<ChatSummary | null> {
    const stmt = this.db.prepare(`SELECT * FROM summaries WHERE userId = ? ORDER BY id DESC LIMIT 1`);
    const row = stmt.get(userId) as ChatSummary | undefined;
    return row || null;
  }

  async saveSummary(userId: number, content: string, lastMessageId: number): Promise<void> {
    const stmt = this.db.prepare(`INSERT INTO summaries (userId, content, lastMessageId) VALUES (?, ?, ?)`);
    stmt.run(userId, content, lastMessageId);
  }

  // --- Memories ---
  async getMemories(userId: number): Promise<Memory[]> {
    const stmt = this.db.prepare(`SELECT * FROM memories WHERE userId = ? ORDER BY id ASC`);
    return stmt.all(userId) as Memory[];
  }

  async saveMemory(userId: number, content: string): Promise<void> {
    const checkStmt = this.db.prepare(`SELECT id FROM memories WHERE userId = ? AND content = ?`);
    const exist = checkStmt.get(userId, content);
    
    if (!exist) {
      const insertStmt = this.db.prepare(`INSERT INTO memories (userId, content) VALUES (?, ?)`);
      insertStmt.run(userId, content);
    }
  }

  async clearMemories(userId: number): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM memories WHERE userId = ?`);
    stmt.run(userId);
  }
}

export const chatRepository = new SqliteChatRepository();
