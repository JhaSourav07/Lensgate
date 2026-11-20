import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import stream from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { AdapterRegistry } from '../adapters/index.js';
import { Interceptor } from './interceptor.js';
import { UpstreamDispatcher } from './upstream.js';
import { WebSocketGateway } from '../ws/gateway.js';
import { ProjectScanner } from '../intelligence/scanner.js';
import { IntelligenceDetector } from '../intelligence/detector.js';
import { RulesEngine } from '../intelligence/rules-engine.js';
import {
  extractCodeAttachmentsFromText,
  computeTokenBreakdown,
} from '../intelligence/token-counter.js';

export class MitmManager {
  private certsDir: string;
  private caKeyPath: string;
  private caCertPath: string;
  private hostCertsDir: string;
  private hostCertCache = new Map<string, { key: Buffer; cert: Buffer }>();

  // Domains targeted for AI context inspection
  private interceptedDomains = [
    'generativelanguage.googleapis.com',
    'api.openai.com',
    'api.anthropic.com',
    'api.mistral.ai',
    'api.groq.com',
  ];

  constructor() {
    this.certsDir = path.join(os.homedir(), '.lensgate', 'certs');
    this.caKeyPath = path.join(this.certsDir, 'ca.key');
    this.caCertPath = path.join(this.certsDir, 'ca.pem');
    this.hostCertsDir = path.join(this.certsDir, 'hosts');
    this.ensureRootCA();
  }

  getRootCaPath(): string {
    return this.caCertPath;
  }

  private ensureRootCA(): void {
    if (!fs.existsSync(this.hostCertsDir)) {
      fs.mkdirSync(this.hostCertsDir, { recursive: true });
    }

    if (!fs.existsSync(this.caKeyPath) || !fs.existsSync(this.caCertPath)) {
      try {
        console.log('[Lensgate MITM] Generating local Root Certificate Authority...');
        execSync(`openssl genrsa -out "${this.caKeyPath}" 2048 2>/dev/null`);
        execSync(
          `openssl req -x509 -new -nodes -key "${this.caKeyPath}" -sha256 -days 3650 -out "${this.caCertPath}" ` +
          `-subj "/CN=Lensgate Local Proxy Root CA/O=Lensgate" 2>/dev/null`
        );
        console.log(`[Lensgate MITM] CA certificate generated at: ${this.caCertPath}`);
      } catch (err: any) {
        console.error('[Lensgate MITM] Failed to generate CA:', err.message);
      }
    }
  }

  getOrCreateHostCert(hostname: string): { key: Buffer; cert: Buffer } {
    if (this.hostCertCache.has(hostname)) {
      return this.hostCertCache.get(hostname)!;
    }

    const hostKeyPath = path.join(this.hostCertsDir, `${hostname}.key`);
    const hostCertPath = path.join(this.hostCertsDir, `${hostname}.pem`);

    if (!fs.existsSync(hostKeyPath) || !fs.existsSync(hostCertPath)) {
      try {
        const extFile = path.join(this.hostCertsDir, `${hostname}.ext`);
        fs.writeFileSync(extFile, `subjectAltName = DNS:${hostname}\n`);

        execSync(`openssl genrsa -out "${hostKeyPath}" 2048 2>/dev/null`);
        execSync(`openssl req -new -key "${hostKeyPath}" -out "${hostKeyPath}.csr" -subj "/CN=${hostname}" 2>/dev/null`);
        execSync(
          `openssl x509 -req -in "${hostKeyPath}.csr" -CA "${this.caCertPath}" -CAkey "${this.caKeyPath}" ` +
          `-CAcreateserial -out "${hostCertPath}" -days 365 -sha256 -extfile "${extFile}" 2>/dev/null`
        );

        try { fs.unlinkSync(`${hostKeyPath}.csr`); } catch {}
        try { fs.unlinkSync(extFile); } catch {}
      } catch (err: any) {
        console.error(`[Lensgate MITM] Failed to generate cert for ${hostname}:`, err.message);
      }
    }

    const result = {
      key: fs.readFileSync(hostKeyPath),
      cert: fs.readFileSync(hostCertPath),
    };
    this.hostCertCache.set(hostname, result);
    return result;
  }

  isInterceptedDomain(hostname: string): boolean {
    const cleanHost = hostname.split(':')[0].toLowerCase();
    return this.interceptedDomains.some(
      (d) => cleanHost === d || cleanHost.endsWith('.' + d)
    );
  }

  handleConnect(
    req: http.IncomingMessage,
    clientSocket: stream.Duplex,
    head: Buffer,
    registry: AdapterRegistry,
    interceptor: Interceptor,
    dispatcher: UpstreamDispatcher,
    wsGateway: WebSocketGateway,
    scanner?: ProjectScanner,
    detector?: IntelligenceDetector,
    rulesEngine?: RulesEngine
  ): void {
    const [hostname, portStr] = (req.url || '').split(':');
    const port = parseInt(portStr || '443', 10);

    // Pass-through raw TCP for non-AI domains (e.g. telemetry, github, marketplace)
    if (!this.isInterceptedDomain(hostname)) {
      const serverSocket = net.connect(port, hostname, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
      });

      serverSocket.on('error', () => {
        clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      });
      clientSocket.on('error', () => {
        serverSocket.end();
      });
      return;
    }

    // Intercept AI domains: Terminate TLS, parse payload, control, dispatch upstream
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

    const hostCert = this.getOrCreateHostCert(hostname);
    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key: hostCert.key,
      cert: hostCert.cert,
    });

    let buffer = Buffer.alloc(0);
    tlsSocket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Check if full HTTP request received
      const headerEndIndex = buffer.indexOf('\r\n\r\n');
      if (headerEndIndex === -1) return;

      const headerText = buffer.slice(0, headerEndIndex).toString('utf-8');
      const lines = headerText.split('\r\n');
      const [method, pathUrl] = lines[0].split(' ');

      const headers: Record<string, string> = {};
      for (let i = 1; i < lines.length; i++) {
        const colonIdx = lines[i].indexOf(':');
        if (colonIdx !== -1) {
          const k = lines[i].slice(0, colonIdx).trim().toLowerCase();
          const v = lines[i].slice(colonIdx + 1).trim();
          headers[k] = v;
        }
      }

      const contentLength = parseInt(headers['content-length'] || '0', 10);
      const bodyStartIndex = headerEndIndex + 4;
      if (buffer.length < bodyStartIndex + contentLength) {
        return; // Wait for full body
      }

      const bodyBuffer = buffer.slice(bodyStartIndex, bodyStartIndex + contentLength);
      buffer = buffer.slice(bodyStartIndex + contentLength); // Advance buffer

      let body: any = null;
      try {
        body = JSON.parse(bodyBuffer.toString('utf-8'));
      } catch {
        body = bodyBuffer.toString('utf-8');
      }

      // Route through Lensgate Control Plane
      headers['x-original-path'] = pathUrl;
      const adapter = registry.findAdapter(pathUrl, headers, body);
      if (!adapter) {
        // Fallback pass-through if unhandled
        tlsSocket.end('HTTP/1.1 400 Unsupported AI Endpoint\r\n\r\n');
        return;
      }

      const requestId = uuidv4();
      const startTime = Date.now();
      const envelope = adapter.toEnvelope({
        id: requestId,
        path: pathUrl,
        headers,
        body,
      });

      const allContextText = envelope.context.conversationTurns
        .map((t) => (typeof t.content === 'string' ? t.content : JSON.stringify(t.content)))
        .join('\n');
      envelope.context.codeAttachments = extractCodeAttachmentsFromText(allContextText);
      envelope.tokenBreakdown = computeTokenBreakdown(envelope.context);

      if (rulesEngine) {
        rulesEngine.applyAutoRules(envelope, scanner?.getCachedProfile());
      }
      if (detector) {
        envelope.alerts = detector.analyze(envelope, scanner?.getCachedProfile());
      }

      wsGateway.broadcastIntercepted(envelope);
      const decision = await interceptor.enqueue(envelope);

      if (decision.action === 'drop') {
        wsGateway.broadcastCompleted(requestId, Date.now() - startTime, 403);
        const errResp = JSON.stringify({ error: 'Request dropped by developer in Lensgate' });
        tlsSocket.write(`HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: ${errResp.length}\r\n\r\n${errResp}`);
        return;
      }

      if (decision.modifiedBody) {
        envelope.modifiedBody = decision.modifiedBody;
      }

      const upstreamPayload = adapter.toUpstreamPayload(envelope);

      try {
        const dispatchResult = await dispatcher.dispatch(
          upstreamPayload,
          adapter,
          (delta) => {
            wsGateway.broadcastStreamChunk(requestId, delta);
          }
        );

        let resHeadersStr = `HTTP/1.1 ${dispatchResult.statusCode} OK\r\n`;
        for (const [k, v] of Object.entries(dispatchResult.headers)) {
          if (!['content-length', 'connection'].includes(k.toLowerCase())) {
            resHeadersStr += `${k}: ${v}\r\n`;
          }
        }

        if (typeof dispatchResult.body === 'string') {
          const bodyBytes = Buffer.from(dispatchResult.body);
          resHeadersStr += `Content-Length: ${bodyBytes.length}\r\nConnection: close\r\n\r\n`;
          tlsSocket.write(resHeadersStr);
          tlsSocket.write(bodyBytes);
          tlsSocket.end();
          wsGateway.broadcastCompleted(requestId, Date.now() - startTime, dispatchResult.statusCode);
        } else {
          resHeadersStr += `Transfer-Encoding: chunked\r\n\r\n`;
          tlsSocket.write(resHeadersStr);
          const reader = (dispatchResult.body as any).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunkSizeHex = value.length.toString(16);
            tlsSocket.write(`${chunkSizeHex}\r\n`);
            tlsSocket.write(value);
            tlsSocket.write('\r\n');
          }
          tlsSocket.write('0\r\n\r\n');
          tlsSocket.end();
          wsGateway.broadcastCompleted(requestId, Date.now() - startTime, dispatchResult.statusCode);
        }
      } catch (err: any) {
        wsGateway.broadcastCompleted(requestId, Date.now() - startTime, 502);
        const errJson = JSON.stringify({ error: err.message });
        tlsSocket.write(`HTTP/1.1 502 Bad Gateway\r\nContent-Type: application/json\r\nContent-Length: ${errJson.length}\r\n\r\n${errJson}`);
      }
    });

    tlsSocket.on('error', () => {
      clientSocket.destroy();
    });
  }
}
