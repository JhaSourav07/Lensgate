import {
  LensgateContextEnvelope,
  SystemInstructionBlock,
  ConversationTurn,
  ToolDefinition,
} from '@lensgate/shared';
import { BaseAdapter, RequestInfo, UpstreamPayload } from './base.js';

export class OpenAIAdapter implements BaseAdapter {
  readonly provider = 'openai' as const;

  matches(path: string, _headers: Record<string, any>, body: any): boolean {
    if (path.includes('/chat/completions')) return true;
    if (body && Array.isArray(body.messages) && typeof body.model === 'string') return true;
    return false;
  }

  toEnvelope(reqInfo: RequestInfo): LensgateContextEnvelope {
    const body = reqInfo.body || {};
    const messages: any[] = Array.isArray(body.messages) ? body.messages : [];

    const systemInstructions: SystemInstructionBlock[] = [];
    const conversationTurns: ConversationTurn[] = [];

    messages.forEach((msg, idx) => {
      const role = msg.role;
      if (role === 'system' || role === 'developer') {
        systemInstructions.push({
          id: `sys-${idx}`,
          source: role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          mutable: true,
        });
      } else {
        conversationTurns.push({
          id: `turn-${idx}`,
          role: role,
          content: msg.content,
          toolCalls: msg.tool_calls,
          toolOutputs: role === 'tool' ? [msg.content] : undefined,
        });
      }
    });

    const tools: ToolDefinition[] = Array.isArray(body.tools)
      ? body.tools.map((t: any) => ({
          name: t.function?.name || t.name || 'unknown',
          description: t.function?.description || t.description,
          parameters: t.function?.parameters || t.parameters,
        }))
      : [];

    return {
      id: reqInfo.id,
      timestamp: Date.now(),
      provider: this.provider,
      model: body.model || 'gpt-4o',
      stream: Boolean(body.stream),
      context: {
        systemInstructions,
        conversationTurns,
        codeAttachments: [],
        tools,
      },
      rawHeaders: reqInfo.headers,
      rawBody: body,
      status: 'pending',
    };
  }

  toUpstreamPayload(envelope: LensgateContextEnvelope): UpstreamPayload {
    const upstreamBase = process.env.OPENAI_UPSTREAM_URL || 'https://api.openai.com/v1/chat/completions';

    // If modifiedBody explicitly provided, prioritize it
    let body: any;
    if (envelope.modifiedBody) {
      body = envelope.modifiedBody;
    } else {
      // Reconstruct from envelope context
      const messages: any[] = [];

      envelope.context.systemInstructions.forEach((sys) => {
        messages.push({
          role: sys.source === 'developer' ? 'developer' : 'system',
          content: sys.content,
        });
      });

      envelope.context.conversationTurns.forEach((turn) => {
        const item: any = {
          role: turn.role,
          content: turn.content,
        };
        if (turn.toolCalls) item.tool_calls = turn.toolCalls;
        messages.push(item);
      });

      body = {
        ...envelope.rawBody,
        model: envelope.model,
        messages,
        stream: envelope.stream,
      };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    // Propagate authorization
    const authHeader = envelope.rawHeaders['authorization'] || envelope.rawHeaders['Authorization'];
    if (authHeader) {
      headers['authorization'] = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    }

    return {
      url: upstreamBase,
      headers,
      body,
    };
  }

  extractStreamDelta(chunk: string): string | null {
    const lines = chunk.split('\n');
    let deltaText = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) deltaText += delta;
      } catch {
        // Ignore unparseable partial lines
      }
    }
    return deltaText || null;
  }
}

