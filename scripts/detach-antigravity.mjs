import { AntigravityIntegrationManager } from '../packages/core/dist/integrations/antigravity.js';

const manager = new AntigravityIntegrationManager();
console.log('\x1b[36m[Lensgate]\x1b[0m Detaching Lensgate from Antigravity IDE...');

const result = manager.detach();
if (result.success) {
  console.log('\x1b[32m[✓] ' + result.message + '\x1b[0m');
  console.log('Antigravity IDE settings restored to default.');
} else {
  console.error('\x1b[31m[x] ' + result.message + '\x1b[0m');
  process.exit(1);
}
