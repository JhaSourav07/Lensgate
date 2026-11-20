import fs from 'node:fs';
import path from 'node:path';
import {
  CodeAttachment,
  ConversationTurn,
  SystemInstructionBlock,
  TokenBreakdown,
  ToolDefinition,
} from '@lensgate/shared';

// Approximate 3.8 - 4 characters per token for standard code/prose
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3.8));
}

export interface FileTokenInfo {
  path: string;
  relativePath: string;
  tokens: number;
  sizeBytes: number;
  lines: number;
  extension: string;
}

export interface FolderTokenSummary {
  folder: string;
  tokens: number;
  fileCount: number;
}

export interface WorkspaceTokenReport {
  rootPath: string;
  totalTokens: number;
  totalFiles: number;
  topFiles: FileTokenInfo[];
  folderBreakdown: FolderTokenSummary[];
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.gemini',
  '.next',
  '.cache',
  'coverage',
  '.turbo',
  '.output',
  'venv',
  '.venv',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tar', '.gz',
  '.exe', '.bin', '.so', '.dylib', '.dll', '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.mov', '.tsbuildinfo',
]);

export function scanWorkspaceTokens(rootPath: string): WorkspaceTokenReport {
  const resolvedRoot = path.resolve(rootPath);
  const files: FileTokenInfo[] = [];
  const folderTokens = new Map<string, { tokens: number; count: number }>();

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        try {
          const stats = fs.statSync(fullPath);
          if (stats.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

          const content = fs.readFileSync(fullPath, 'utf-8');
          const tokens = estimateTokens(content);
          const lines = content.split('\n').length;
          const relativePath = path.relative(resolvedRoot, fullPath);

          files.push({
            path: fullPath,
            relativePath,
            tokens,
            sizeBytes: stats.size,
            lines,
            extension: ext || 'txt',
          });

          // Group by immediate top-level relative folder
          const segments = relativePath.split(path.sep);
          const topFolder = segments.length > 1 ? segments[0] : '(root)';
          const existing = folderTokens.get(topFolder) || { tokens: 0, count: 0 };
          folderTokens.set(topFolder, {
            tokens: existing.tokens + tokens,
            count: existing.count + 1,
          });
        } catch {}
      }
    }
  }

  walk(resolvedRoot);

  files.sort((a, b) => b.tokens - a.tokens);

  const totalTokens = files.reduce((acc, f) => acc + f.tokens, 0);
  const folderBreakdown: FolderTokenSummary[] = Array.from(folderTokens.entries())
    .map(([folder, val]) => ({
      folder,
      tokens: val.tokens,
      fileCount: val.count,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  return {
    rootPath: resolvedRoot,
    totalTokens,
    totalFiles: files.length,
    topFiles: files.slice(0, 50),
    folderBreakdown,
  };
}

export function extractCodeAttachmentsFromText(text: string): CodeAttachment[] {
  if (!text) return [];
  const attachments: CodeAttachment[] = [];

  // Match file tags or code fence comments: ```lang:path/to/file or File: path/to/file
  const fenceRegex = /```(?:[a-zA-Z0-9_-]+[:\s]+)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    const filePath = match[1];
    const content = match[2];
    if (content.length > 20) {
      attachments.push({
        path: filePath,
        content,
        tokenCount: estimateTokens(content),
      });
    }
  }

  // Match XML style <file path="...">...</file>
  const xmlRegex = /<file\s+path=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi;
  while ((match = xmlRegex.exec(text)) !== null) {
    const filePath = match[1];
    const content = match[2];
    attachments.push({
      path: filePath,
      content,
      tokenCount: estimateTokens(content),
    });
  }

  return attachments;
}

export function computeTokenBreakdown(context: {
  systemInstructions: SystemInstructionBlock[];
  conversationTurns: ConversationTurn[];
  codeAttachments: CodeAttachment[];
  tools: ToolDefinition[];
}): TokenBreakdown {
  const systemText = context.systemInstructions.map((s) => s.content).join('\n');
  const turnsText = context.conversationTurns
    .map((t) => (typeof t.content === 'string' ? t.content : JSON.stringify(t.content)))
    .join('\n');
  const codeText = context.codeAttachments.map((c) => c.content).join('\n');
  const toolsText = JSON.stringify(context.tools || []);

  const systemTokens = estimateTokens(systemText);
  const turnsTokens = estimateTokens(turnsText);
  const codeTokens = estimateTokens(codeText);
  const toolsTokens = estimateTokens(toolsText);
  const totalTokens = systemTokens + turnsTokens + codeTokens + toolsTokens;

  return {
    systemTokens,
    turnsTokens,
    codeTokens,
    toolsTokens,
    totalTokens,
  };
}
