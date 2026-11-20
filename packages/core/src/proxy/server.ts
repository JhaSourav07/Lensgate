import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import websocketPlugin from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdapterRegistry } from '../adapters/index.js';
import { Interceptor } from './interceptor.js';
import { UpstreamDispatcher } from './upstream.js';
import { WebSocketGateway } from '../ws/gateway.js';
import { MitmManager } from './mitm.js';
import { AntigravityIntegrationManager } from '../integrations/antigravity.js';
import { ProjectScanner } from '../intelligence/scanner.js';
import { IntelligenceDetector } from '../intelligence/detector.js';
import { RulesEngine } from '../intelligence/rules-engine.js';
import {
  scanWorkspaceTokens,
  extractCodeAttachmentsFromText,
  computeTokenBreakdown,
} from '../intelligence/token-counter.js';
import { VerifiedProjectProfile, ContextCorrectionRule } from '@lensgate/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const potentialUiPaths = [
  path.resolve(__dirname, '../../../ui/dist'),
  path.resolve(process.cwd(), 'packages/ui/dist'),
  path.resolve(process.cwd(), 'ui/dist'),
];

export interface ServerOptions {
  port?: number;
  initialMode?: 'observe' | 'control';
}

export function createLensgateServer(options: ServerOptions = {}): {
  app: FastifyInstance;
  interceptor: Interceptor;
  wsGateway: WebSocketGateway;
  scanner: ProjectScanner;
  detector: IntelligenceDetector;
  rulesEngine: RulesEngine;
  start: () => Promise<void>;
} {
  const port = options.port || 8088;
  const app = Fastify({ logger: false });

  const registry = new AdapterRegistry();
  const interceptor = new Interceptor(options.initialMode || 'control');
  const dispatcher = new UpstreamDispatcher();
  const wsGateway = new WebSocketGateway(interceptor);
  const mitm = new MitmManager();
  const antigravity = new AntigravityIntegrationManager();
  const scanner = new ProjectScanner();
  const detector = new IntelligenceDetector();
  const rulesEngine = new RulesEngine();

  // Initialize project scan
  scanner.scan().catch(() => {});

  // Attach HTTP CONNECT listener for HTTPS proxying (Antigravity IDE, Cursor, etc.)
  app.server.on('connect', (req, clientSocket, head) => {
    mitm.handleConnect(
      req,
      clientSocket,
      head,
      registry,
      interceptor,
      dispatcher,
      wsGateway,
      scanner,
      detector,
      rulesEngine
    );
  });

  app.register(cors, { origin: '*' });
  app.register(websocketPlugin);

  // Health and management endpoints
  app.get('/health', async () => ({ status: 'ok', name: 'Lensgate Proxy' }));

  app.get('/api/ca.pem', async (_req, reply) => {
    const caPath = mitm.getRootCaPath();
    if (fs.existsSync(caPath)) {
      const caBytes = fs.readFileSync(caPath);
      return reply.type('application/x-x509-ca-cert').send(caBytes);
    }
    return reply.status(404).send({ error: 'CA certificate not found' });
  });

  app.get('/api/status', async () => ({
    mode: interceptor.getMode(),
    pendingCount: interceptor.getPendingCount(),
    port,
  }));

  // Antigravity integration management
  app.get('/api/integrations/antigravity/status', async () => antigravity.getStatus());
  app.post('/api/integrations/antigravity/attach', async () => antigravity.attach());
  app.post('/api/integrations/antigravity/detach', async () => antigravity.detach());

  // Native Antigravity Hook Interception
  app.post('/api/hook/intercept', async (req: FastifyRequest<{
    Body: {
      conversationId?: string;
      lastUserInput?: string;
      modelName?: string;
      hookEventName?: string;
      cwd?: string;
      workspacePaths?: string[];
    }
  }>, reply) => {
    const { conversationId, lastUserInput, modelName, cwd } = req.body || {};
    const requestId = uuidv4();
    const promptText = lastUserInput || 'Session Prompt';

    const envelope: any = {
      id: requestId,
      timestamp: Date.now(),
      sessionToken: conversationId,
      provider: 'antigravity',
      model: modelName || 'gemini-model',
      stream: false,
      context: {
        systemInstructions: [
          {
            id: 'sys-0',
            source: 'Antigravity Workspace',
            content: `Active Directory: ${cwd || process.cwd()}`,
            mutable: true,
          },
        ],
        conversationTurns: [
          {
            id: 'turn-0',
            role: 'user',
            content: promptText,
          },
        ],
        codeAttachments: [],
        tools: [],
      },
      rawHeaders: req.headers as Record<string, string>,
      rawBody: {
        conversationId,
        messages: [{ role: 'user', content: promptText }],
        model: modelName || 'gemini-model',
        cwd,
      },
      status: 'pending',
    };

    // Extract attachments & compute token consumption breakdown
    envelope.context.codeAttachments = extractCodeAttachmentsFromText(promptText);
    envelope.tokenBreakdown = computeTokenBreakdown(envelope.context);

    // Auto-apply active rules & analyze for misinterpretations/bloat/secrets
    rulesEngine.applyAutoRules(envelope, scanner.getCachedProfile());
    envelope.alerts = detector.analyze(envelope, scanner.getCachedProfile());

    // Broadcast to UI
    wsGateway.broadcastIntercepted(envelope);

    // Enqueue in interceptor (pauses here if mode === 'control'!)
    const decision = await interceptor.enqueue(envelope);

    if (decision.action === 'drop') {
      wsGateway.broadcastCompleted(requestId, Date.now() - envelope.timestamp, 403);
      return reply.send({ action: 'drop', requestId });
    }

    wsGateway.broadcastCompleted(requestId, Date.now() - envelope.timestamp, 200);
    return reply.send({
      action: 'forward',
      requestId,
      modifiedBody: decision.modifiedBody,
    });
  });

  app.get('/api/pending', async () => ({
    pending: interceptor.getPendingEnvelopes(),
  }));

  app.post('/api/action/forward', async (req: FastifyRequest<{ Body: { requestId: string; modifiedBody?: any } }>, reply) => {
    const { requestId, modifiedBody } = req.body || {};
    const success = interceptor.resolve(requestId, 'forward', modifiedBody);
    wsGateway.broadcastStatus();
    return reply.status(success ? 200 : 404).send({ success });
  });

  app.post('/api/action/drop', async (req: FastifyRequest<{ Body: { requestId: string } }>, reply) => {
    const { requestId } = req.body || {};
    const success = interceptor.resolve(requestId, 'drop');
    wsGateway.broadcastStatus();
    return reply.status(success ? 200 : 404).send({ success });
  });

  app.post('/api/config/mode', async (req: FastifyRequest<{ Body: { mode: 'observe' | 'control' } }>, reply) => {
    const { mode } = req.body || {};
    if (mode === 'observe' || mode === 'control') {
      interceptor.setMode(mode);
      wsGateway.broadcastStatus();
      return reply.send({ success: true, mode });
    }
    return reply.status(400).send({ error: 'Invalid mode' });
  });

  // Intelligence & Context Scanner endpoints
  app.post('/api/intelligence/scan', async (req: FastifyRequest<{ Body: { rootDir?: string } }>) => {
    const { rootDir } = req.body || {};
    return scanner.scan(rootDir || process.cwd());
  });

  app.get('/api/intelligence/profile', async () => {
    let profile = scanner.getCachedProfile();
    if (!profile) {
      profile = await scanner.scan(process.cwd());
    }
    return profile;
  });

  app.post('/api/intelligence/profile', async (req: FastifyRequest<{ Body: VerifiedProjectProfile }>) => {
    if (req.body) {
      scanner.setCachedProfile(req.body);
      return { success: true, profile: req.body };
    }
    return { success: false };
  });

  app.get('/api/intelligence/rules', async () => {
    return { rules: rulesEngine.getRules() };
  });

  app.post('/api/intelligence/rules', async (req: FastifyRequest<{ Body: ContextCorrectionRule }>) => {
    const rule = req.body;
    rulesEngine.addRule(rule);
    return { success: true, rule };
  });

  app.patch('/api/intelligence/rules/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Partial<ContextCorrectionRule> }>) => {
    const success = rulesEngine.updateRule(req.params.id, req.body);
    return { success };
  });

  app.delete('/api/intelligence/rules/:id', async (req: FastifyRequest<{ Params: { id: string } }>) => {
    const success = rulesEngine.deleteRule(req.params.id);
    return { success };
  });

  app.post('/api/intelligence/fix', async (req: FastifyRequest<{ Body: { requestId: string; action: string } }>, reply) => {
    const { requestId, action } = req.body || {};
    const pendingEnvelopes = interceptor.getPendingEnvelopes();
    const envelope = pendingEnvelopes.find((e) => e.id === requestId);
    if (!envelope) return reply.status(404).send({ error: 'Request not pending' });

    const profile = scanner.getCachedProfile();
    const result = rulesEngine.applyQuickFix(envelope, action, profile);
    if (result.modified) {
      envelope.alerts = detector.analyze(envelope, profile);
      envelope.tokenBreakdown = computeTokenBreakdown(envelope.context);
      wsGateway.broadcastIntercepted(envelope);
    }
    return reply.send({ success: result.modified, envelope });
  });

  // Workspace File & Token Explorer API
  app.post('/api/context/workspace-tokens', async (req: FastifyRequest<{ Body: { dirPath?: string } }>) => {
    const { dirPath } = req.body || {};
    const targetDir = dirPath || process.cwd();
    return scanWorkspaceTokens(targetDir);
  });

  // WebSocket registration
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (connection) => {
      wsGateway.addClient(connection);
    });
  });

  // Core Interception Catch-All (excluding OPTIONS which is managed by fastify-cors)
  app.route({
    method: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
    url: '/*',
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/ws') || req.url === '/health') {
      return;
    }

    // Serve Lensgate Dashboard UI if requested
    if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/' || req.url.startsWith('/assets/') || req.url === '/vite.svg' || !req.url.startsWith('/v1'))) {
      const uiDist = potentialUiPaths.find((p) => fs.existsSync(p));
      if (uiDist) {
        let filePath = path.join(uiDist, req.url === '/' ? 'index.html' : req.url);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(uiDist, 'index.html');
        }
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
          };
          const contentType = mimeTypes[ext] || 'text/plain';
          const content = fs.readFileSync(filePath);
          return reply.type(contentType).send(content);
        }
      }
    }

    const startTime = Date.now();
    const requestId = uuidv4();
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const body = req.body;

    const adapter = registry.findAdapter(req.url, headers, body);
    if (!adapter) {
      return reply.status(400).send({
        error: 'Unsupported AI model provider endpoint',
        path: req.url,
      });
    }

    const envelope = adapter.toEnvelope({
      id: requestId,
      path: req.url,
      headers,
      body,
    });

    const allContextText = envelope.context.conversationTurns
      .map((t) => (typeof t.content === 'string' ? t.content : JSON.stringify(t.content)))
      .join('\n');
    envelope.context.codeAttachments = extractCodeAttachmentsFromText(allContextText);
    envelope.tokenBreakdown = computeTokenBreakdown(envelope.context);

    // Auto-apply active rules & analyze for misinterpretations/bloat/secrets
    rulesEngine.applyAutoRules(envelope, scanner.getCachedProfile());
    envelope.alerts = detector.analyze(envelope, scanner.getCachedProfile());

    // Notify UI of intercepted request
    wsGateway.broadcastIntercepted(envelope);

    // Enqueue or pass through depending on interceptor mode
    const decision = await interceptor.enqueue(envelope);

    if (decision.action === 'drop') {
      wsGateway.broadcastCompleted(requestId, Date.now() - startTime, 403);
      return reply.status(403).send({
        error: 'Request dropped by developer in Lensgate',
        requestId,
      });
    }

    if (decision.modifiedBody) {
      envelope.modifiedBody = decision.modifiedBody;
    }

    const upstreamPayload = adapter.toUpstreamPayload(envelope);

    try {
      const dispatchResult = await dispatcher.dispatch(
        upstreamPayload,
        adapter,
        (chunkDelta) => {
          wsGateway.broadcastStreamChunk(requestId, chunkDelta);
        }
      );

      // Relay headers
      for (const [key, val] of Object.entries(dispatchResult.headers)) {
        if (!['content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          reply.header(key, val);
        }
      }

      reply.status(dispatchResult.statusCode);

      if (dispatchResult.isStream && typeof dispatchResult.body !== 'string') {
        const nodeStream = (dispatchResult.body as any);
        wsGateway.broadcastCompleted(requestId, Date.now() - startTime, dispatchResult.statusCode);
        return reply.send(nodeStream);
      } else {
        wsGateway.broadcastCompleted(requestId, Date.now() - startTime, dispatchResult.statusCode);
        return reply.send(dispatchResult.body);
      }
    } catch (err: any) {
      wsGateway.broadcastCompleted(requestId, Date.now() - startTime, 502);
      return reply.status(502).send({
        error: 'Upstream gateway error',
        message: err.message,
      });
    }
  }
});

  const start = async () => {
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`[Lensgate] Control Plane running on http://localhost:${port}`);
  };

  return { app, interceptor, wsGateway, scanner, detector, rulesEngine, start };
}
