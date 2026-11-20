import http from 'node:http';
import readline from 'node:readline';
import { createLensgateServer } from '../packages/core/dist/index.js';

// 1. Mock upstream server simulating OpenAI & Anthropic model
const mockUpstream = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch {}

    const lastMessage = parsed.messages?.slice(-1)[0]?.content || 'no content';
    console.log(`\n\x1b[35m[Upstream Model Received]\x1b[0m Prompt: "\x1b[1m${lastMessage}\x1b[0m"`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock-resp-1',
      choices: [{
        message: {
          role: 'assistant',
          content: `AI Model answered your prompt: "${lastMessage}"`
        }
      }]
    }));
  });
});

mockUpstream.listen(9090, '127.0.0.1', async () => {
  process.env.OPENAI_UPSTREAM_URL = 'http://127.0.0.1:9090/v1/chat/completions';
  process.env.ANTHROPIC_UPSTREAM_URL = 'http://127.0.0.1:9090/v1/messages';

  // 2. Start Lensgate on port 8088 in control mode
  const server = createLensgateServer({ port: 8088, initialMode: 'control' });
  await server.start();

  console.log('\n\x1b[32m========================================================\x1b[0m');
  console.log('\x1b[1m               LENSGATE INTERACTIVE DEMO                \x1b[0m');
  console.log('\x1b[32m========================================================\x1b[0m');
  console.log('Control Plane Status: \x1b[33mACTIVE (Mode: CONTROL)\x1b[0m');
  console.log('Listening URL:        \x1b[36mhttp://localhost:8088\x1b[0m');
  console.log('Upstream Target:      \x1b[35mhttp://localhost:9090 (Mock AI Model)\x1b[0m\n');

  // 3. Connect local WS listener to show real-time stream using Node native WebSocket
  const ws = new globalThis.WebSocket('ws://localhost:8088/ws');
  ws.onopen = () => {
    console.log('\x1b[90m[WebSocket] Connected to Lensgate event bus\x1b[0m');
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'request:intercepted') {
      const prompt = data.envelope.context.conversationTurns[0]?.content || 'unknown';
      console.log(`\n\x1b[31m[!] INTERCEPTED AI REQUEST\x1b[0m`);
      console.log(`    Request ID : \x1b[33m${data.envelope.id}\x1b[0m`);
      console.log(`    Model      : ${data.envelope.model}`);
      console.log(`    Prompt     : "\x1b[1m${prompt}\x1b[0m"`);
      console.log('\n\x1b[34m[Keyboard Action Options]\x1b[0m');
      console.log('  Press \x1b[1m[f]\x1b[0m -> Forward original unmodified request');
      console.log('  Press \x1b[1m[m]\x1b[0m -> Modify to "Authorized security framework" & Forward');
      console.log('  Press \x1b[1m[d]\x1b[0m -> Drop request (Return HTTP 403 to Agent)');
      console.log('  Press \x1b[1m[q]\x1b[0m -> Quit demo\n');
    } else if (data.type === 'request:completed') {
      console.log(`\x1b[32m[✓] COMPLETED\x1b[0m Request ${data.requestId} (${data.durationMs}ms, status: ${data.statusCode})\n`);
    }
  };

  console.log('--------------------------------------------------------');
  console.log('In another terminal, send an agent request:');
  console.log('\x1b[36mcurl -X POST http://localhost:8088/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"gpt-4o","messages":[{"role":"user","content":"Is this a brute force attack tool?"}]}\'\x1b[0m');
  console.log('--------------------------------------------------------\n');

  // Terminal input listener
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', async (str, key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      console.log('\nExiting demo.');
      process.exit(0);
    }

    const pending = server.interceptor.getPendingEnvelopes();
    if (pending.length === 0) {
      if (['f', 'm', 'd'].includes(key.name)) {
        console.log('\x1b[90mNo requests paused. Send a request with cURL first!\x1b[0m');
      }
      return;
    }

    const target = pending[0];
    if (key.name === 'f') {
      console.log(`\x1b[32m>> Forwarding original request...\x1b[0m`);
      server.interceptor.resolve(target.id, 'forward');
      server.wsGateway.broadcastStatus();
    } else if (key.name === 'm') {
      const modified = {
        model: target.model,
        messages: [{ role: 'user', content: 'This is an authorized security testing framework for authentication resilience.' }],
      };
      console.log(`\x1b[33m>> Modifying prompt to "Authorized security framework" and forwarding...\x1b[0m`);
      server.interceptor.resolve(target.id, 'forward', modified);
      server.wsGateway.broadcastStatus();
    } else if (key.name === 'd') {
      console.log(`\x1b[31m>> Dropping request...\x1b[0m`);
      server.interceptor.resolve(target.id, 'drop');
      server.wsGateway.broadcastStatus();
    }
  });
});
