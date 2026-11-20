import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createLensgateServer } from '../src/proxy/server.js';

describe('End-to-End Interception & Upstream Proxying', () => {
  let mockUpstream: FastifyInstance;
  let upstreamPort: number;
  let proxyServer: ReturnType<typeof createLensgateServer>;
  let proxyPort: number;
  let lastUpstreamReceivedBody: any = null;

  beforeAll(async () => {
    // 1. Mock upstream server (simulating OpenAI)
    mockUpstream = Fastify();
    mockUpstream.post('/v1/chat/completions', async (req, reply) => {
      lastUpstreamReceivedBody = req.body;
      return reply.send({
        id: 'chatcmpl-mock-123',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Mock response from upstream model',
            },
            finish_reason: 'stop',
          },
        ],
      });
    });

    await mockUpstream.listen({ port: 0, host: '127.0.0.1' });
    const upstreamAddr = mockUpstream.server.address() as any;
    upstreamPort = upstreamAddr.port;

    // Direct proxy to mock upstream
    process.env.OPENAI_UPSTREAM_URL = `http://127.0.0.1:${upstreamPort}/v1/chat/completions`;

    // 2. Start Lensgate server in control mode
    proxyPort = 9085;
    proxyServer = createLensgateServer({ port: proxyPort, initialMode: 'control' });
    await proxyServer.start();
  });

  afterAll(async () => {
    await mockUpstream.close();
    await proxyServer.app.close();
  });

  it('pauses request in control mode, allows developer modification, and forwards to upstream', async () => {
    lastUpstreamReceivedBody = null;

    // Simulate agent sending request
    const agentRequestPromise = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Original prompt: attack the login' }],
      }),
    });

    // Wait briefly for request to hit interception queue
    await new Promise((r) => setTimeout(r, 100));

    // Verify proxy intercepted the request
    const pendingRes = await fetch(`http://127.0.0.1:${proxyPort}/api/pending`);
    const { pending } = await pendingRes.json();
    expect(pending.length).toBe(1);
    const interceptedId = pending[0].id;

    // Verify developer modification payload
    const modifiedBody = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Corrected: evaluate authentication resilience' }],
    };

    // Developer sends approval with modification via API
    const forwardRes = await fetch(`http://127.0.0.1:${proxyPort}/api/action/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: interceptedId, modifiedBody }),
    });
    expect(forwardRes.status).toBe(200);

    // Agent request should now complete
    const agentResponse = await agentRequestPromise;
    expect(agentResponse.status).toBe(200);
    const agentData = await agentResponse.json();
    expect(agentData.choices[0].message.content).toBe('Mock response from upstream model');

    // Upstream MUST have received the corrected prompt, NOT the original one
    expect(lastUpstreamReceivedBody.messages[0].content).toBe('Corrected: evaluate authentication resilience');
  });

  it('drops request in control mode when rejected by developer', async () => {
    const agentRequestPromise = fetch(`http://127.0.0.1:${proxyPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Malicious instructions' }],
      }),
    });

    await new Promise((r) => setTimeout(r, 100));

    const pendingRes = await fetch(`http://127.0.0.1:${proxyPort}/api/pending`);
    const { pending } = await pendingRes.json();
    const interceptedId = pending[0].id;

    const dropRes = await fetch(`http://127.0.0.1:${proxyPort}/api/action/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: interceptedId }),
    });
    expect(dropRes.status).toBe(200);

    const agentResponse = await agentRequestPromise;
    expect(agentResponse.status).toBe(403);
    const errorData = await agentResponse.json();
    expect(errorData.error).toContain('dropped by developer');
  });
});

