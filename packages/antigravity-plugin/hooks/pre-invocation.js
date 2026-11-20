#!/usr/bin/env node
import fs from 'node:fs';

// Read JSON payload from Antigravity lifecycle runner via stdin
let input = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', async () => {
  try {
    const payload = input ? JSON.parse(input) : {};
    const lensgatePort = process.env.LENSGATE_PORT || '8088';

    // Verify Lensgate Control Plane is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);

    const res = await fetch(`http://127.0.0.1:${lensgatePort}/api/status`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const status = await res.json();
      // Inject developer-controlled context rules into Antigravity conversation
      const output = {
        injectSteps: [
          {
            systemMessage: {
              systemMessage: `[LENSGATE CONTROL PLANE: ACTIVE (Mode: ${status.mode})]\nEnforcing developer-verified project definitions and inspecting model transmissions at port ${lensgatePort}.`,
            },
          },
        ],
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(0);
    }
  } catch {
    // Graceful fallback: do not interrupt Antigravity if Lensgate is offline
  }

  process.stdout.write('{}');
  process.exit(0);
});

