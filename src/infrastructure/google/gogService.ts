// src/infrastructure/google/gogService.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import { env } from '../../config/env';

const execPromise = promisify(exec);

export class GogService {
  private async execute(command: string): Promise<string> {
    const accountFlag = env.GOG_ACCOUNT ? `--account ${env.GOG_ACCOUNT}` : '';
    const fullCommand = `gog ${command} ${accountFlag}`;
    
    console.log(`[GogService] Executing: ${fullCommand}`);
    
    try {
      const { stdout, stderr } = await execPromise(fullCommand);
      if (stderr) {
        console.warn(`[GogService] Stderr: ${stderr}`);
      }
      return stdout.trim();
    } catch (error: any) {
      console.error(`[GogService] Error executing command: ${error.message}`);
      return `Error: ${error.message}${error.stdout ? '\nOutput: ' + error.stdout : ''}`;
    }
  }

  // Gmail
  async gmailSearch(query: string, max: number = 10): Promise<string> {
    return this.execute(`gmail messages search "${query}" --max ${max} --json`);
  }

  async gmailSend(to: string, subject: string, body: string): Promise<string> {
    return this.execute(`gmail send --to "${to}" --subject "${subject}" --body "${body}"`);
  }

  // Calendar
  async calendarListEvents(calendarId: string = 'primary', from?: string, to?: string): Promise<string> {
    let cmd = `calendar events ${calendarId}`;
    if (from) cmd += ` --from ${from}`;
    if (to) cmd += ` --to ${to}`;
    return this.execute(`${cmd} --json`);
  }

  async calendarCreateEvent(calendarId: string = 'primary', summary: string, from: string, to: string): Promise<string> {
    return this.execute(`calendar create ${calendarId} --summary "${summary}" --from ${from} --to ${to}`);
  }

  // Drive
  async driveSearch(query: string, max: number = 10): Promise<string> {
    return this.execute(`drive search "${query}" --max ${max} --json`);
  }

  // Sheets
  async sheetsGet(sheetId: string, range: string): Promise<string> {
    return this.execute(`sheets get ${sheetId} "${range}" --json`);
  }

  // Contacts
  async contactsList(max: number = 20): Promise<string> {
    return this.execute(`contacts list --max ${max} --json`);
  }
}

export const gogService = new GogService();
