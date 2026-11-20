import { describe, it, expect } from 'vitest';
import { GeminiAdapter } from '../src/adapters/gemini.js';

describe('GeminiAdapter', () => {
  const adapter = new GeminiAdapter();

  it('matches Gemini generateContent and streamGenerateContent endpoints', () => {
    expect(adapter.matches('/v1beta/models/gemini-2.5-flash:generateContent', {}, {})).toBe(true);
    expect(adapter.matches('/v1beta/models/gemini-2.0-flash:streamGenerateContent', {}, {})).toBe(true);
    expect(adapter.matches('/other', {}, { contents: [], systemInstruction: {} })).toBe(true);
    expect(adapter.matches('/v1/chat/completions', {}, {})).toBe(false);
  });

  it('normalizes Gemini payload into Universal Context Envelope and reconstructs it', () => {
    const rawBody = {
      systemInstruction: {
        role: 'user',
        parts: [{ text: 'You are an AI coding assistant in Antigravity.' }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Audit authentication resilience.' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Understood. Reviewing auth endpoints.' }],
        },
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: 'run_command',
              description: 'Execute a bash command',
              parameters: { type: 'object' },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    };

    const envelope = adapter.toEnvelope({
      id: 'req-gemini-1',
      path: '/v1beta/models/gemini-2.5-pro:generateContent',
      headers: {
        'x-goog-api-key': 'test-gemini-key',
        'x-original-path': '/v1beta/models/gemini-2.5-pro:generateContent',
      },
      body: rawBody,
    });

    expect(envelope.provider).toBe('gemini');
    expect(envelope.model).toBe('gemini-2.5-pro');
    expect(envelope.context.systemInstructions).toHaveLength(1);
    expect(envelope.context.systemInstructions[0].content).toBe('You are an AI coding assistant in Antigravity.');

    expect(envelope.context.conversationTurns).toHaveLength(2);
    expect(envelope.context.conversationTurns[0].role).toBe('user');
    expect(envelope.context.conversationTurns[0].content).toBe('Audit authentication resilience.');
    expect(envelope.context.conversationTurns[1].role).toBe('assistant');

    expect(envelope.context.tools).toHaveLength(1);
    expect(envelope.context.tools[0].name).toBe('run_command');

    // Test reconstruction
    const upstream = adapter.toUpstreamPayload(envelope);
    expect(upstream.url).toContain('/v1beta/models/gemini-2.5-pro:generateContent');
    expect(upstream.headers['x-goog-api-key']).toBe('test-gemini-key');
    expect(upstream.body.contents).toHaveLength(2);
    expect(upstream.body.systemInstruction.parts[0].text).toBe('You are an AI coding assistant in Antigravity.');
  });

  it('extracts streaming chunk text delta from Gemini response', () => {
    const sseChunk = 'data: {"candidates":[{"content":{"parts":[{"text":"Evaluating password strength..."}]}}]}\n\n';
    expect(adapter.extractStreamDelta(sseChunk)).toBe('Evaluating password strength...');
  });
});

