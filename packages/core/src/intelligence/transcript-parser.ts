import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CodeAttachment,
  ConversationTurn,
  SystemInstructionBlock,
  TokenBreakdown,
} from '@lensgate/shared';
import { estimateTokens } from './token-counter.js';

export interface AgentStoredFile {
  path: string;
  relativePath: string;
  content: string;
  tokens: number;
  lines: number;
  sizeBytes: number;
  lastReadStep: number;
}

export interface AgentContextMemory {
  conversationId: string;
  transcriptPath: string;
  storedFiles: AgentStoredFile[];
  turns: ConversationTurn[];
  systemInstructions: SystemInstructionBlock[];
  tokenBreakdown: TokenBreakdown;
}

export class TranscriptParser {
  findActiveTranscriptPath(conversationId?: string): string | null {
    const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    if (!fs.existsSync(brainDir)) return null;

    if (conversationId) {
      const direct = path.join(brainDir, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(direct)) return direct;
    }

    try {
      const dirs = fs.readdirSync(brainDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => {
          const tPath = path.join(brainDir, d.name, '.system_generated', 'logs', 'transcript.jsonl');
          if (fs.existsSync(tPath)) {
            const stats = fs.statSync(tPath);
            return { path: tPath, mtime: stats.mtimeMs };
          }
          return null;
        })
        .filter(Boolean) as { path: string; mtime: number }[];

      dirs.sort((a, b) => b.mtime - a.mtime);
      return dirs[0]?.path || null;
    } catch {
      return null;
    }
  }

  parseTranscript(transcriptPath: string, cwd: string = process.cwd()): AgentContextMemory {
    if (!fs.existsSync(transcriptPath)) {
      return {
        conversationId: 'unknown',
        transcriptPath,
        storedFiles: [],
        turns: [],
        systemInstructions: [],
        tokenBreakdown: {
          systemTokens: 0,
          turnsTokens: 0,
          codeTokens: 0,
          toolsTokens: 0,
          totalTokens: 0,
        },
      };
    }

    const conversationId = path.basename(path.dirname(path.dirname(path.dirname(transcriptPath))));
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);

    const storedFilesMap = new Map<string, AgentStoredFile>();
    const turns: ConversationTurn[] = [];
    const systemInstructions: SystemInstructionBlock[] = [
      {
        id: 'workspace-cwd',
        source: 'Antigravity Workspace',
        content: `Active Workspace Directory: ${cwd}`,
        mutable: true,
      },
    ];

    let pendingReadPath: string | null = null;
    let pendingStepIndex = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);

        if (entry.type === 'USER_INPUT') {
          let userContent = entry.content || '';
          // Strip system tags if present
          const userRequestMatch = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(userContent);
          if (userRequestMatch) {
            userContent = userRequestMatch[1].trim();
          }

          turns.push({
            id: `turn-${entry.step_index || turns.length}`,
            role: 'user',
            content: userContent,
          });
        } else if (entry.type === 'PLANNER_RESPONSE') {
          turns.push({
            id: `turn-${entry.step_index || turns.length}`,
            role: 'assistant',
            content: entry.thinking ? `[Thinking]: ${entry.thinking.slice(0, 300)}...` : (entry.content || 'Action executed'),
            toolCalls: entry.tool_calls,
          });

          // Check if agent invoked read_file
          if (entry.tool_calls) {
            for (const tc of entry.tool_calls) {
              if (tc.name === 'read_file' && tc.args?.Path) {
                pendingReadPath = String(tc.args.Path).replace(/^"|"$/g, '');
                pendingStepIndex = entry.step_index || 0;
              }
            }
          }
        } else if (entry.type === 'GENERIC' && pendingReadPath) {
          // Tool output from read_file - this is the file content the AI has stored!
          const content = entry.content || '';
          if (content.length > 0) {
            const relativePath = path.isAbsolute(pendingReadPath)
              ? path.relative(cwd, pendingReadPath)
              : pendingReadPath;

            storedFilesMap.set(pendingReadPath, {
              path: pendingReadPath,
              relativePath,
              content,
              tokens: estimateTokens(content),
              lines: content.split('\n').length,
              sizeBytes: Buffer.byteLength(content, 'utf-8'),
              lastReadStep: pendingStepIndex,
            });
          }
          pendingReadPath = null;
        } else if (entry.type === 'SYSTEM_MESSAGE' && entry.content) {
          systemInstructions.push({
            id: `sys-${entry.step_index || systemInstructions.length}`,
            source: 'Antigravity System Notice',
            content: entry.content.slice(0, 500),
            mutable: false,
          });
        }
      } catch {}
    }

    const storedFiles = Array.from(storedFilesMap.values()).sort((a, b) => b.tokens - a.tokens);

    // Compute token breakdown
    const codeTokens = storedFiles.reduce((acc, f) => acc + f.tokens, 0);
    const turnsTokens = turns.reduce(
      (acc, t) => acc + (typeof t.content === 'string' ? estimateTokens(t.content) : 100),
      0
    );
    const systemTokens = systemInstructions.reduce((acc, s) => acc + estimateTokens(s.content), 0);
    const totalTokens = codeTokens + turnsTokens + systemTokens;

    return {
      conversationId,
      transcriptPath,
      storedFiles,
      turns,
      systemInstructions,
      tokenBreakdown: {
        systemTokens,
        turnsTokens,
        codeTokens,
        toolsTokens: 500, // estimated tools schema
        totalTokens: totalTokens + 500,
      },
    };
  }

  /**
   * Converts AgentContextMemory to CodeAttachment[]
   */
  toCodeAttachments(memory: AgentContextMemory): CodeAttachment[] {
    return memory.storedFiles.map((f) => ({
      path: f.relativePath,
      content: f.content,
      tokenCount: f.tokens,
    }));
  }
}
