import { LensgateContextEnvelope, InterceptMode } from './envelope.js';

export interface InterceptedEvent {
  type: 'request:intercepted';
  envelope: LensgateContextEnvelope;
}

export interface StreamChunkEvent {
  type: 'request:stream_chunk';
  requestId: string;
  chunk: string;
  timestamp: number;
}

export interface CompletedEvent {
  type: 'request:completed';
  requestId: string;
  durationMs: number;
  statusCode: number;
  tokens?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StatusEvent {
  type: 'proxy:status';
  mode: InterceptMode;
  pendingCount: number;
  port: number;
}

export type ServerEvent =
  | InterceptedEvent
  | StreamChunkEvent
  | CompletedEvent
  | StatusEvent;

export interface ForwardAction {
  type: 'action:forward';
  requestId: string;
  modifiedBody?: any;
}

export interface DropAction {
  type: 'action:drop';
  requestId: string;
  reason?: string;
}

export interface SetModeAction {
  type: 'config:set_mode';
  mode: InterceptMode;
}

export type ClientAction =
  | ForwardAction
  | DropAction
  | SetModeAction;
