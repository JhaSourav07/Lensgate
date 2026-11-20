#!/usr/bin/env node
import fs from 'node:fs';

function updateTranscript(transcriptPath, originalInput, modifiedContent) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = raw.split('\n');
    let updated = false;

    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].trim()) continue;
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'USER_INPUT' && typeof entry.content === 'string') {
          const userRequestRegex = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/;
          if (userRequestRegex.test(entry.content)) {
            entry.content = entry.content.replace(userRequestRegex, `<USER_REQUEST>\n${modifiedContent}\n</USER_REQUEST>`);
          } else {
            entry.content = modifiedContent;
          }
          lines[i] = JSON.stringify(entry);
          updated = true;
          break;
        }
      } catch {}
    }

    if (updated) {
      fs.writeFileSync(transcriptPath, lines.join('\n'), 'utf-8');

      // Also update transcript_full.jsonl if present
      const fullPath = transcriptPath.replace('transcript.jsonl', 'transcript_full.jsonl');
      if (fs.existsSync(fullPath) && fullPath !== transcriptPath) {
        updateTranscript(fullPath, originalInput, modifiedContent);
      }
    }
  } catch {
    // Non-fatal
  }
}

let input = '';
process.stdin.setEncoding('utf-8');

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', async () => {
  try {
    const payload = input ? JSON.parse(input) : {};
    const lensgatePort = process.env.LENSGATE_PORT || '8088';
    const originalInput = (payload.lastUserInput || '').trim();

    // Intercept call via Lensgate Control Plane
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 290000); // 290s timeout

    const res = await fetch(`http://127.0.0.1:${lensgatePort}/api/hook/intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: payload.conversationId,
        lastUserInput: originalInput,
        modelName: payload.modelName,
        hookEventName: payload.hookEventName,
        cwd: payload.cwd,
        workspacePaths: payload.workspacePaths,
      }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      const decision = await res.json();

      if (decision.action === 'drop') {
        const dropOutput = {
          terminationBehavior: 'terminate',
          injectSteps: [
            {
              errorMessage: {
                userMessage: 'Request dropped by developer in Lensgate.',
              },
            },
          ],
        };
        process.stdout.write(JSON.stringify(dropOutput));
        process.exit(0);
      }

      // Check if developer modified prompt or injected instructions
      const modified = decision.modifiedBody;
      let modifiedUserContent = null;
      let systemOverride = null;

      if (modified) {
        if (Array.isArray(modified.messages)) {
          const userMsg = modified.messages.find((m) => m.role === 'user')?.content;
          if (userMsg && userMsg !== originalInput) {
            modifiedUserContent = typeof userMsg === 'string' ? userMsg : JSON.stringify(userMsg);
          }
          const sysMsg = modified.messages.find((m) => m.role === 'system')?.content;
          if (sysMsg) {
            systemOverride = typeof sysMsg === 'string' ? sysMsg : JSON.stringify(sysMsg);
          }
        } else if (typeof modified.prompt === 'string' && modified.prompt !== originalInput) {
          modifiedUserContent = modified.prompt;
        }
      }

      // Transparent prompt rewrite in transcript - completely invisible to agent
      if (modifiedUserContent && payload.transcriptPath) {
        updateTranscript(payload.transcriptPath, originalInput, modifiedUserContent);
      }

      const injectSteps = [];
      if (systemOverride) {
        injectSteps.push({
          systemMessage: {
            systemMessage: systemOverride,
          },
        });
      }

      // Return clean JSON without any Lensgate banners or notices
      if (injectSteps.length > 0) {
        process.stdout.write(JSON.stringify({ injectSteps }));
      } else {
        process.stdout.write('{}');
      }
      process.exit(0);
    }
  } catch (err) {
    // Graceful fallback if server offline
  }

  process.stdout.write('{}');
  process.exit(0);
});
