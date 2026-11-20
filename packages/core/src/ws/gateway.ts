import { WebSocket } from 'ws';
import {
  ServerEvent,
  ClientAction,
  LensgateContextEnvelope,
  InterceptMode,
} from '@lensgate/shared';
import { Interceptor } from '../proxy/interceptor.js';

export class WebSocketGateway {
  private clients = new Set<WebSocket>();

  constructor(private interceptor: Interceptor) {}

  addClient(ws: WebSocket): void {
    this.clients.add(ws);

    // Send immediate status
    this.broadcastStatus();

    ws.on('message', (data: Buffer | string) => {
      try {
        const action: ClientAction = JSON.parse(data.toString());
        this.handleClientAction(action);
      } catch (err) {
        console.error('[Lensgate WS] Failed to parse client message:', err);
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  private handleClientAction(action: ClientAction): void {
    if (action.type === 'action:forward') {
      this.interceptor.resolve(action.requestId, 'forward', action.modifiedBody);
      this.broadcastStatus();
    } else if (action.type === 'action:drop') {
      this.interceptor.resolve(action.requestId, 'drop');
      this.broadcastStatus();
    } else if (action.type === 'config:set_mode') {
      this.interceptor.setMode(action.mode);
      this.broadcastStatus();
    }
  }

  broadcast(event: ServerEvent): void {
    const payload = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  broadcastIntercepted(envelope: LensgateContextEnvelope): void {
    this.broadcast({
      type: 'request:intercepted',
      envelope,
    });
    this.broadcastStatus();
  }

  broadcastStreamChunk(requestId: string, chunk: string): void {
    this.broadcast({
      type: 'request:stream_chunk',
      requestId,
      chunk,
      timestamp: Date.now(),
    });
  }

  broadcastCompleted(requestId: string, durationMs: number, statusCode: number): void {
    this.broadcast({
      type: 'request:completed',
      requestId,
      durationMs,
      statusCode,
    });
    this.broadcastStatus();
  }

  broadcastStatus(): void {
    this.broadcast({
      type: 'proxy:status',
      mode: this.interceptor.getMode(),
      pendingCount: this.interceptor.getPendingCount(),
      port: 8080,
    });
  }
}

