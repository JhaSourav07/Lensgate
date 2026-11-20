import {
  LensgateContextEnvelope,
  SystemInstructionBlock,
  ConversationTurn,
  ToolDefinition,
} from '@lensgate/shared';
import { BaseAdapter, RequestInfo, UpstreamPayload } from './base.js';

export class GeminiAdapter implements BaseAdapter {
  readonly provider = 'gemini' as const;

  matches(path: string, _headers: Record<string, any>, body: any): boolean {
    if (path.includes(':generateContent') || path.includes(':streamGenerateContent')) return true;
    if (path.includes('/v1beta/models/') || path.includes('/v1/models/')) return true;
    if (body && Array.isArray(body.contents) && (body.systemInstruction || body.generationConfig || body.tools)) {
      return true;
    }
    return false;
  }

  toEnvelope(reqInfo: RequestInfo): LensgateContextEnvelope {
    const body = reqInfo.body || {};
    const contents: any[] = Array.isArray(body.contents) ? body.contents : [];

    // Extract model from URL path (e.g. /v1beta/models/gemini-2.5-flash:generateContent)
    let model = 'gemini-model';
    const modelMatch = reqInfo.path.match(/models\/([^:]+)/);
    if (modelMatch) {
      model = modelMatch[1];
    } else if (body.model) {
      model = body.model;
    }

    const isStream = reqInfo.path.includes(':streamGenerateContent') || Boolean(body.stream);

    // Extract system instructions
    const systemInstructions: SystemInstructionBlock[] = [];
    if (body.systemInstruction?.parts) {
      const textParts = body.systemInstruction.parts
        .map((p: any) => p.text || '')
        .filter(Boolean)
        .join('\n');

      if (textParts) {
        systemInstructions.push({
          id: 'sys-0',
          source: 'systemInstruction',
          content: textParts,
          mutable: true,
        });
      }
    }

    // Extract conversation turns
    const conversationTurns: ConversationTurn[] = contents.map((c, idx) => {
      const role = c.role === 'model' ? 'assistant' : 'user';
      const textParts = (c.parts || [])
        .map((p: any) => {
          if (p.text) return p.text;
          if (p.functionCall) return `[FunctionCall: ${p.functionCall.name}(${JSON.stringify(p.functionCall.args)})]`;
          if (p.functionResponse) return `[FunctionResponse: ${p.functionResponse.name}]`;
          return '';
        })
        .filter(Boolean)
        .join('\n');

      return {
        id: `turn-${idx}`,
        role,
        content: textParts || (c.parts?.length === 1 && c.parts[0].text ? c.parts[0].text : c.parts),
        toolCalls: c.parts?.filter((p: any) => p.functionCall).map((p: any) => p.functionCall),
        toolOutputs: c.parts?.filter((p: any) => p.functionResponse).map((p: any) => p.functionResponse),
      };
    });

    // Extract tools
    const tools: ToolDefinition[] = [];
    if (Array.isArray(body.tools)) {
      for (const t of body.tools) {
        if (Array.isArray(t.functionDeclarations)) {
          for (const fn of t.functionDeclarations) {
            tools.push({
              name: fn.name,
              description: fn.description,
              parameters: fn.parameters,
            });
          }
        }
      }
    }

    return {
      id: reqInfo.id,
      timestamp: Date.now(),
      provider: this.provider,
      model,
      stream: isStream,
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
    const upstreamDomain = process.env.GEMINI_UPSTREAM_URL || 'https://generativelanguage.googleapis.com';
    const originalPath = (envelope.rawHeaders['x-original-path'] as string) ||
      (envelope.stream
        ? `/v1beta/models/${envelope.model}:streamGenerateContent?alt=sse`
        : `/v1beta/models/${envelope.model}:generateContent`);

    const fullUrl = upstreamDomain.startsWith('http')
      ? `${upstreamDomain.replace(/\/$/, '')}${originalPath.startsWith('/') ? '' : '/'}${originalPath}`
      : `https://${upstreamDomain}${originalPath}`;

    let body: any;
    if (envelope.modifiedBody) {
      body = envelope.modifiedBody;
    } else {
      // Reconstruct compliant Gemini body
      const contents = envelope.context.conversationTurns.map((turn) => {
        const parts = Array.isArray(turn.content)
          ? turn.content
          : [{ text: typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content) }];

        return {
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      let systemInstruction: any = undefined;
      if (envelope.context.systemInstructions.length > 0) {
        systemInstruction = {
          role: 'user',
          parts: envelope.context.systemInstructions.map((s) => ({ text: s.content })),
        };
      }

      body = {
        ...envelope.rawBody,
        contents,
      };
      if (systemInstruction) {
        body.systemInstruction = systemInstruction;
      }
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    // Propagate API key & Auth
    const apiKey = envelope.rawHeaders['x-goog-api-key'];
    if (apiKey) {
      headers['x-goog-api-key'] = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    }

    const auth = envelope.rawHeaders['authorization'] || envelope.rawHeaders['Authorization'];
    if (auth) {
      headers['authorization'] = Array.isArray(auth) ? auth[0] : auth;
    }

    return {
      url: fullUrl,
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
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) deltaText += text;
      } catch {
        // Ignore partial lines
      }
    }
    return deltaText || null;
  }
}

