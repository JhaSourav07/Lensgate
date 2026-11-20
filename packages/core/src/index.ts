import { createLensgateServer } from './proxy/server.js';

export * from './adapters/index.js';
export * from './proxy/interceptor.js';
export * from './proxy/upstream.js';
export * from './proxy/server.js';
export * from './ws/gateway.js';

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = createLensgateServer({ port });
  server.start().catch((err) => {
    console.error('[Lensgate] Fatal error starting server:', err);
    process.exit(1);
  });
}
