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
  folder: string;
  content: string;
  tokens: number;
  lines: number;
  sizeBytes: number;
  lastReadStep: number;
  outputStepIndex: number;
}

export interface AgentTurnMemory {
  id: string;
  stepIndex: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: any[];
}

export interface AgentContextMemory {
  conversationId: string;
  transcriptPath: string;
  rootFolder: string;
  storedFiles: AgentStoredFile[];
  turns: AgentTurnMemory[];
  systemInstructions: SystemInstructionBlock[];
  tokenBreakdown: TokenBreakdown;
  availableFolders: string[];
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

  parseTranscript(
    transcriptPath: string,
    cwd: string = process.cwd(),
    folderFilter?: string
  ): AgentContextMemory {
    if (!fs.existsSync(transcriptPath)) {
      return {
        conversationId: 'unknown',
        transcriptPath,
        rootFolder: cwd,
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
        availableFolders: [],
      };
    }

    const conversationId = path.basename(path.dirname(path.dirname(path.dirname(transcriptPath))));
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);

    const storedFilesMap = new Map<string, AgentStoredFile>();
    const turns: AgentTurnMemory[] = [];
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
          const userRequestMatch = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(userContent);
          if (userRequestMatch) {
            userContent = userRequestMatch[1].trim();
          }

          turns.push({
            id: `turn-${entry.step_index || turns.length}`,
            stepIndex: entry.step_index || 0,
            role: 'user',
            content: userContent,
          });
        } else if (entry.type === 'PLANNER_RESPONSE') {
          turns.push({
            id: `turn-${entry.step_index || turns.length}`,
            stepIndex: entry.step_index || 0,
            role: 'assistant',
            content: entry.content || '',
            thinking: entry.thinking || undefined,
            toolCalls: entry.tool_calls,
          });

          if (entry.tool_calls) {
            for (const tc of entry.tool_calls) {
              if (tc.name === 'read_file' && tc.args?.Path) {
                pendingReadPath = String(tc.args.Path).replace(/^"|"$/g, '');
                pendingStepIndex = entry.step_index || 0;
              }
            }
          }
        } else if (entry.type === 'GENERIC' && pendingReadPath) {
          const content = entry.content || '';
          if (content.length > 0) {
            const relativePath = path.isAbsolute(pendingReadPath)
              ? path.relative(cwd, pendingReadPath)
              : pendingReadPath;

            const segments = relativePath.split(path.sep);
            const folder = segments.length > 1 ? segments.slice(0, -1).join('/') : '(root)';

            storedFilesMap.set(pendingReadPath, {
              path: pendingReadPath,
              relativePath,
              folder,
              content,
              tokens: estimateTokens(content),
              lines: content.split('\n').length,
              sizeBytes: Buffer.byteLength(content, 'utf-8'),
              lastReadStep: pendingStepIndex,
              outputStepIndex: entry.step_index || (pendingStepIndex + 1),
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

    let allFiles = Array.from(storedFilesMap.values()).sort((a, b) => b.tokens - a.tokens);
    const availableFolders = Array.from(new Set(allFiles.map((f) => f.folder))).sort();

    // Filter by folder if requested
    if (folderFilter && folderFilter !== 'all') {
      const cleanFilter = folderFilter.toLowerCase();
      allFiles = allFiles.filter(
        (f) =>
          f.folder.toLowerCase().includes(cleanFilter) ||
          f.relativePath.toLowerCase().startsWith(cleanFilter) ||
          f.path.toLowerCase().includes(cleanFilter)
      );
    }

    const codeTokens = allFiles.reduce((acc, f) => acc + f.tokens, 0);
    const turnsTokens = turns.reduce(
      (acc, t) => acc + estimateTokens(t.content) + estimateTokens(t.thinking || ''),
      0
    );
    const systemTokens = systemInstructions.reduce((acc, s) => acc + estimateTokens(s.content), 0);
    const totalTokens = codeTokens + turnsTokens + systemTokens;

    return {
      conversationId,
      transcriptPath,
      rootFolder: cwd,
      storedFiles: allFiles,
      turns,
      systemInstructions,
      tokenBreakdown: {
        systemTokens,
        turnsTokens,
        codeTokens,
        toolsTokens: 500,
        totalTokens: totalTokens + 500,
      },
      availableFolders,
    };
  }

  /**
   * Updates file content in the session transcript on disk
   */
  updateFileInMemory(transcriptPath: string, filePath: string, newContent: string): boolean {
    if (!fs.existsSync(transcriptPath)) return false;
    try {
      const raw = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = raw.split('\n');
      let updated = false;

      let targetStepIndex = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
            for (const tc of entry.tool_calls) {
              if (tc.name === 'read_file' && tc.args?.Path) {
                const p = String(tc.args.Path).replace(/^"|"$/g, '');
                if (p === filePath || p.endsWith(filePath) || filePath.endsWith(p)) {
                  targetStepIndex = entry.step_index;
                  break;
                }
              }
            }
            if (targetStepIndex !== -1) break;
          }
        } catch {}
      }

      if (targetStepIndex !== -1) {
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.step_index === targetStepIndex + 1 && entry.type === 'GENERIC') {
              entry.content = newContent;
              lines[i] = JSON.stringify(entry);
              updated = true;
              break;
            }
          } catch {}
        }
      }

      if (updated) {
        fs.writeFileSync(transcriptPath, lines.join('\n'), 'utf-8');
        const fullPath = transcriptPath.replace('transcript.jsonl', 'transcript_full.jsonl');
        if (fs.existsSync(fullPath) && fullPath !== transcriptPath) {
          this.updateFileInMemory(fullPath, filePath, newContent);
        }
        return true;
      }
    } catch (err) {
      console.error('Failed to update file in memory:', err);
    }
    return false;
  }

  /**
   * Updates conversation turn (user input, model output, or model thinking) in transcript
   */
  updateTurnInMemory(
    transcriptPath: string,
    stepIndex: number,
    newContent: string,
    newThinking?: string
  ): boolean {
    if (!fs.existsSync(transcriptPath)) return false;
    try {
      const raw = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = raw.split('\n');
      let updated = false;

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.step_index === stepIndex) {
            if (entry.type === 'USER_INPUT') {
              const userRequestRegex = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/;
              if (userRequestRegex.test(entry.content)) {
                entry.content = entry.content.replace(
                  userRequestRegex,
                  `<USER_REQUEST>\n${newContent}\n</USER_REQUEST>`
                );
              } else {
                entry.content = newContent;
              }
              lines[i] = JSON.stringify(entry);
              updated = true;
              break;
            } else if (entry.type === 'PLANNER_RESPONSE') {
              if (newThinking !== undefined) {
                entry.thinking = newThinking;
              }
              if (newContent !== undefined) {
                entry.content = newContent;
              }
              lines[i] = JSON.stringify(entry);
              updated = true;
              break;
            }
          }
        } catch {}
      }

      if (updated) {
        fs.writeFileSync(transcriptPath, lines.join('\n'), 'utf-8');
        const fullPath = transcriptPath.replace('transcript.jsonl', 'transcript_full.jsonl');
        if (fs.existsSync(fullPath) && fullPath !== transcriptPath) {
          this.updateTurnInMemory(fullPath, stepIndex, newContent, newThinking);
        }
        return true;
      }
    } catch (err) {
      console.error('Failed to update turn in memory:', err);
    }
    return false;
  }

  toCodeAttachments(memory: AgentContextMemory): CodeAttachment[] {
    return memory.storedFiles.map((f) => ({
      path: f.relativePath,
      content: f.content,
      tokenCount: f.tokens,
    }));
  }
}
