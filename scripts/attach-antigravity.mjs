import { AntigravityIntegrationManager } from '../packages/core/dist/integrations/antigravity.js';

const manager = new AntigravityIntegrationManager();
console.log('\x1b[36m[Lensgate]\x1b[0m Attaching Lensgate to Antigravity IDE...');

const result = manager.attach({ configureProxy: true });
if (result.success) {
  console.log('\x1b[32m[✓] ' + result.message + '\x1b[0m');
  console.log('\n\x1b[33mActive Configurations:\x1b[0m');
  console.log('  1. Lifecycle Plugin installed to ~/.gemini/config/plugins/lensgate');
  console.log('  2. HTTP Proxy set to http://localhost:8088 in Antigravity IDE settings');
  console.log('\nStart Lensgate with: \x1b[1mpnpm start\x1b[0m');
} else {
  console.error('\x1b[31m[x] ' + result.message + '\x1b[0m');
  process.exit(1);
}

