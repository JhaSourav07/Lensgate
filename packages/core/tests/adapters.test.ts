import { describe, it, expect } from 'vitest';
import { OpenAIAdapter } from '../src/adapters/openai.js';
import { AnthropicAdapter } from '../src/adapters/anthropic.js';

describe('OpenAIAdapter', () => {
  const adapter = new OpenAIAdapter();

  it('correctly matches OpenAI chat completion routes', () => {
    expect(adapter.matches('/v1/chat/completions', {}, { messages: [] })).toBe(true);
    expect(adapter.matches('/chat/completions', {}, {})).toBe(true);
    expect(adapter.matches('/other', {}, { messages: [], model: 'gpt-4o' })).toBe(true);
    expect(adapter.matches('/v1/messages', {}, {})).toBe(false);
  });

  it('normalizes OpenAI payload into LensgateContextEnvelope and reconstructs it', () => {
    const rawBody = {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a security testing assistant.' },
        { role: 'user', content: 'Scan port 80.' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'scan_port',
            description: 'Scans a port',
            parameters: { type: 'object' },
          },
        },
      ],
      stream: true,
    };

    const envelope = adapter.toEnvelope({
      id: 'req-1',
      path: '/v1/chat/completions',
      headers: { authorization: 'Bearer test-key' },
      body: rawBody,
    });

    expect(envelope.id).toBe('req-1');
    expect(envelope.provider).toBe('openai');
    expect(envelope.model).toBe('gpt-4o');
    expect(envelope.stream).toBe(true);

    expect(envelope.context.systemInstructions).toHaveLength(1);
    expect(envelope.context.systemInstructions[0].content).toBe('You are a security testing assistant.');

    expect(envelope.context.conversationTurns).toHaveLength(1);
    expect(envelope.context.conversationTurns[0].role).toBe('user');
    expect(envelope.context.conversationTurns[0].content).toBe('Scan port 80.');

    expect(envelope.context.tools).toHaveLength(1);
    expect(envelope.context.tools[0].name).toBe('scan_port');

    // Test reconstruction
    const upstream = adapter.toUpstreamPayload(envelope);
    expect(upstream.url).toContain('/chat/completions');
    expect(upstream.headers.authorization).toBe('Bearer test-key');
    expect(upstream.body.messages).toHaveLength(2);
    expect(upstream.body.messages[0].role).toBe('system');
  });

  it('extracts streaming chunk deltas', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
    expect(adapter.extractStreamDelta(chunk)).toBe('Hello');
  });
});

describe('AnthropicAdapter', () => {
  const adapter = new AnthropicAdapter();

  it('correctly matches Anthropic messages routes', () => {
    expect(adapter.matches('/v1/messages', {}, {})).toBe(true);
    expect(adapter.matches('/v1/chat', { 'anthropic-version': '2023-06-01' }, {})).toBe(true);
    expect(adapter.matches('/v1/chat', {}, { messages: [], max_tokens: 1024 })).toBe(true);
  });

  it('normalizes Anthropic payload and reconstructs it', () => {
    const rawBody = {
      model: 'claude-3-5-sonnet',
      max_tokens: 1024,
      system: 'Authorized security evaluation framework.',
      messages: [{ role: 'user', content: 'Audit authentication endpoints.' }],
      tools: [
        {
          name: 'check_endpoint',
          description: 'Checks endpoint resilience',
          input_schema: { type: 'object' },
        },
      ],
      stream: true,
    };

    const envelope = adapter.toEnvelope({
      id: 'req-2',
      path: '/v1/messages',
      headers: { 'x-api-key': 'ant-test-key', 'anthropic-version': '2023-06-01' },
      body: rawBody,
    });

    expect(envelope.provider).toBe('anthropic');
    expect(envelope.context.systemInstructions[0].content).toBe('Authorized security evaluation framework.');
    expect(envelope.context.conversationTurns[0].content).toBe('Audit authentication endpoints.');
    expect(envelope.context.tools[0].name).toBe('check_endpoint');

    const upstream = adapter.toUpstreamPayload(envelope);
    expect(upstream.headers['x-api-key']).toBe('ant-test-key');
    expect(upstream.body.system).toBe('Authorized security evaluation framework.');
    expect(upstream.body.messages[0].content).toBe('Audit authentication endpoints.');
  });

  it('extracts Anthropic stream deltas', () => {
    const sse = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"World"}}\n\n';
    expect(adapter.extractStreamDelta(sse)).toBe('World');
  });
});
