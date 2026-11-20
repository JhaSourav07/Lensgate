import { LensgateContextEnvelope } from '@lensgate/shared';

export interface RequestInfo {
  id: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

export interface UpstreamPayload {
  url: string;
  headers: Record<string, string>;
  body: any;
}

export interface BaseAdapter {
  readonly provider: LensgateContextEnvelope['provider'];
  matches(path: string, headers: Record<string, any>, body: any): boolean;
  toEnvelope(reqInfo: RequestInfo): LensgateContextEnvelope;
  toUpstreamPayload(envelope: LensgateContextEnvelope): UpstreamPayload;
  extractStreamDelta(chunk: string): string | null;
}
