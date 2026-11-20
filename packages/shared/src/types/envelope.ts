export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'antigravity' | 'ollama' | 'generic';
export type InterceptStatus = 'pending' | 'forwarded' | 'modified' | 'dropped';
export type InterceptMode = 'observe' | 'control';

export interface SystemInstructionBlock {
  id: string;
  source?: string;
  content: string;
  mutable: boolean;
}

export interface ConversationTurn {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[];
  toolCalls?: any[];
  toolOutputs?: any[];
}

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

export interface CodeAttachment {
  path: string;
  lineRange?: [number, number];
  content: string;
  tokenCount?: number;
}

export interface LensgateContextEnvelope {
  id: string;
  timestamp: number;
  sessionToken?: string;
  provider: ProviderType;
  model: string;
  stream: boolean;

  context: {
    systemInstructions: SystemInstructionBlock[];
    projectPurpose?: {
      verified?: string;
      inferred?: string;
    };
    conversationTurns: ConversationTurn[];
    codeAttachments: CodeAttachment[];
    tools: ToolDefinition[];
  };

  rawHeaders: Record<string, string | string[] | undefined>;
  rawBody: any;

  status: InterceptStatus;
  modifiedBody?: any;
}

