import { LensgateContextEnvelope, InterceptMode } from '@lensgate/shared';

export interface InterceptorDecision {
  action: 'forward' | 'drop';
  modifiedBody?: any;
}

interface PendingEntry {
  envelope: LensgateContextEnvelope;
  resolve: (decision: InterceptorDecision) => void;
  timer: NodeJS.Timeout;
}

export class Interceptor {
  private mode: InterceptMode = 'observe';
  private pending = new Map<string, PendingEntry>();
  private defaultTimeoutMs = 120000;

  constructor(initialMode: InterceptMode = 'observe') {
    this.mode = initialMode;
  }

  getMode(): InterceptMode {
    return this.mode;
  }

  setMode(mode: InterceptMode): void {
    this.mode = mode;
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  getPendingEnvelopes(): LensgateContextEnvelope[] {
    return Array.from(this.pending.values()).map((p) => p.envelope);
  }

  async enqueue(envelope: LensgateContextEnvelope): Promise<InterceptorDecision> {
    if (this.mode === 'observe') {
      envelope.status = 'forwarded';
      return { action: 'forward' };
    }

    return new Promise<InterceptorDecision>((resolve) => {
      envelope.status = 'pending';

      const timer = setTimeout(() => {
        if (this.pending.has(envelope.id)) {
          this.pending.delete(envelope.id);
          envelope.status = 'forwarded';
          resolve({ action: 'forward' });
        }
      }, this.defaultTimeoutMs);

      this.pending.set(envelope.id, {
        envelope,
        resolve,
        timer,
      });
    });
  }

  resolve(requestId: string, action: 'forward' | 'drop', modifiedBody?: any): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;

    clearTimeout(entry.timer);
    this.pending.delete(requestId);

    if (action === 'forward') {
      entry.envelope.status = modifiedBody ? 'modified' : 'forwarded';
      if (modifiedBody) entry.envelope.modifiedBody = modifiedBody;
      entry.resolve({ action: 'forward', modifiedBody });
    } else {
      entry.envelope.status = 'dropped';
      entry.resolve({ action: 'drop' });
    }

    return true;
  }
}
