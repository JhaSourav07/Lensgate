#!/usr/bin/env node
// Antigravity PreToolUse hook for Lensgate
let input = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', async () => {
  try {
    const payload = input ? JSON.parse(input) : {};
    const toolCall = payload.toolCall || {};

    // By default allow tool use, while logging or enforcing safety policies
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
  process.exit(0);
});

