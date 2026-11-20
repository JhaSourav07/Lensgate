import { describe, it, expect } from 'vitest';
import { LensgateContextEnvelope, ServerEvent, ClientAction } from '../src/index.js';

describe('@lensgate/shared schema tests', () => {
  it('correctly constructs and verifies LensgateContextEnvelope type invariants', () => {
    const envelope: LensgateContextEnvelope = {
      id: 'test-uuid',
      timestamp: Date.now(),
      provider: 'openai',
      model: 'gpt-4o',
      stream: false,
      context: {
        systemInstructions: [
          {
            id: 'sys-1',
            source: 'CLAUDE.md',
            content: 'Always write tests first.',
            mutable: true,
          },
        ],
        conversationTurns: [
          {
            id: 'turn-1',
            role: 'user',
            content: 'Hello, world!',
          },
        ],
        codeAttachments: [],
        tools: [],
      },
      rawHeaders: {},
      rawBody: {},
      status: 'pending',
    };

    expect(envelope.id).toBe('test-uuid');
    expect(envelope.context.systemInstructions[0].source).toBe('CLAUDE.md');
  });

  it('verifies client and server event types', () => {
    const clientAction: ClientAction = {
      type: 'action:forward',
      requestId: 'test-req',
    };
    expect(clientAction.type).toBe('action:forward');
  });
});
