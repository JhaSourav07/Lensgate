import { describe, it, expect } from 'vitest';
import { Interceptor } from '../src/proxy/interceptor.js';
import { LensgateContextEnvelope } from '@lensgate/shared';

function createMockEnvelope(id: string): LensgateContextEnvelope {
  return {
    id,
    timestamp: Date.now(),
    provider: 'openai',
    model: 'gpt-4o',
    stream: false,
    context: {
      systemInstructions: [],
      conversationTurns: [],
      codeAttachments: [],
      tools: [],
    },
    rawHeaders: {},
    rawBody: {},
    status: 'pending',
  };
}

describe('Interceptor State Machine', () => {
  it('automatically forwards requests in observe mode', async () => {
    const interceptor = new Interceptor('observe');
    const envelope = createMockEnvelope('req-obs');

    const decision = await interceptor.enqueue(envelope);
    expect(decision.action).toBe('forward');
    expect(envelope.status).toBe('forwarded');
    expect(interceptor.getPendingCount()).toBe(0);
  });

  it('holds requests in control mode until resolved by developer', async () => {
    const interceptor = new Interceptor('control');
    const envelope = createMockEnvelope('req-ctrl');

    const promise = interceptor.enqueue(envelope);
    expect(interceptor.getPendingCount()).toBe(1);
    expect(envelope.status).toBe('pending');

    // Simulate developer forwarding with modification
    const modifiedBody = { model: 'gpt-4o', messages: [{ role: 'user', content: 'Modified' }] };
    const resolved = interceptor.resolve('req-ctrl', 'forward', modifiedBody);

    expect(resolved).toBe(true);
    const decision = await promise;
    expect(decision.action).toBe('forward');
    expect(decision.modifiedBody).toEqual(modifiedBody);
    expect(envelope.status).toBe('modified');
    expect(interceptor.getPendingCount()).toBe(0);
  });

  it('drops request in control mode when rejected by developer', async () => {
    const interceptor = new Interceptor('control');
    const envelope = createMockEnvelope('req-drop');

    const promise = interceptor.enqueue(envelope);
    expect(interceptor.getPendingCount()).toBe(1);

    interceptor.resolve('req-drop', 'drop');

    const decision = await promise;
    expect(decision.action).toBe('drop');
    expect(envelope.status).toBe('dropped');
    expect(interceptor.getPendingCount()).toBe(0);
  });
});
