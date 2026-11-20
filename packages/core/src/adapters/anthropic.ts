import {
  LensgateContextEnvelope,
  SystemInstructionBlock,
  ConversationTurn,
  ToolDefinition,
} from '@lensgate/shared';
import { BaseAdapter, RequestInfo, UpstreamPayload } from './base.js';

export class AnthropicAdapter implements BaseAdapter {
  readonly provider = 'anthropic' as const;

  matches(path: string, headers: Record<string, any>, body: any): boolean {
    if (path.includes('/messages')) return true;
    if (headers['anthropic-version'] || headers['x-api-key']) return true;
    if (body && Array.isArray(body.messages) && typeof body.max_tokens === 'number') return true;
    return false;
  }

  toEnvelope(reqInfo: RequestInfo): LensgateContextEnvelope {
    const body = reqInfo.body || {};
    const messages: any[] = Array.isArray(body.messages) ? body.messages : [];

    const systemInstructions: SystemInstructionBlock[] = [];
    if (body.system) {
      if (typeof body.system === 'string') {
        systemInstructions.push({
          id: 'sys-0',
          source: 'system',
          content: body.system,
          mutable: true,
        });
      } else if (Array.isArray(body.system)) {
        body.system.forEach((sys: any, idx: number) => {
          systemInstructions.push({
            id: `sys-${idx}`,
            source: sys.type || 'system',
            content: typeof sys.text === 'string' ? sys.text : JSON.stringify(sys),
            mutable: true,
          });
        });
      }
    }

    const conversationTurns: ConversationTurn[] = messages.map((msg, idx) => ({
      id: `turn-${idx}`,
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));

    const tools: ToolDefinition[] = Array.isArray(body.tools)
      ? body.tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        }))
      : [];

    return {
      id: reqInfo.id,
      timestamp: Date.now(),
      provider: this.provider,
      model: body.model || 'claude-3-5-sonnet',
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
    const upstreamBase = process.env.ANTHROPIC_UPSTREAM_URL || 'https://api.anthropic.com/v1/messages';

    let body: any;
    if (envelope.modifiedBody) {
      body = envelope.modifiedBody;
    } else {
      // Reconstruct
      let system: any = undefined;
      if (envelope.context.systemInstructions.length === 1) {
        system = envelope.context.systemInstructions[0].content;
      } else if (envelope.context.systemInstructions.length > 1) {
        system = envelope.context.systemInstructions.map((s) => ({
          type: 'text',
          text: s.content,
        }));
      }

      const messages = envelope.context.conversationTurns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      }));

      body = {
        ...envelope.rawBody,
        model: envelope.model,
        system,
        messages,
        stream: envelope.stream,
      };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': (envelope.rawHeaders['anthropic-version'] as string) || '2023-06-01',
    };

    const apiKey = envelope.rawHeaders['x-api-key'];
    if (apiKey) {
      headers['x-api-key'] = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    }

    const auth = envelope.rawHeaders['authorization'];
    if (auth) {
      headers['authorization'] = Array.isArray(auth) ? auth[0] : auth;
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
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          deltaText += parsed.delta.text;
        }
      } catch {
        // Ignore partial lines
      }
    }
    return deltaText || null;
  }
}

