# Phase 1 Implementation Plan: Proxy Core & Universal Envelope Normalizer

---

## Objective
Establish the local proxy server, provider normalization layer (OpenAI + Anthropic), WebSocket event bus, and in-memory interception queue with support for streaming responses.

---

## 1. Project Scaffolding
- Initialize PNPM workspace:
  - `packages/shared`: Universal context envelope, message protocols, event payloads.
  - `packages/core`: Proxy engine, adapters, WebSocket bus, upstream dispatcher.
- Configure TypeScript (`tsconfig.base.json`, strict ESM).
- Core dependencies:
  - `fastify`: High-throughput HTTP server.
  - `@fastify/websocket`: Bi-directional UI coordination.
  - `zod`: Runtime validation of envelopes and payloads.
  - `undici`: Native HTTP client for upstream streaming.
  - `uuid`: Request ID generation.

---

## 2. Universal Schema Definition (`packages/shared/src/types/`)
1. **`envelope.ts`**:
   - `LensgateContextEnvelope`: Universal structure storing normalized system instructions, conversation turns, tools, metadata, raw headers, and interception status (`intercepted`, `forwarded`, `modified`, `dropped`).
2. **`events.ts`**:
   - Outbound WebSocket events:
     - `request:intercepted`
     - `request:stream_chunk`
     - `request:completed`
     - `proxy:status`
   - Inbound WebSocket commands:
     - `action:forward` (with optional modified body)
     - `action:drop`
     - `config:set_mode` (`observe` | `control`)

---

## 3. Provider Adapters (`packages/core/src/adapters/`)
1. **`BaseAdapter` interface**:
   - `matches(req: FastifyRequest): boolean`
   - `toEnvelope(req: FastifyRequest): Promise<LensgateContextEnvelope>`
   - `toUpstreamPayload(envelope: LensgateContextEnvelope): { url: string; headers: Record<string, string>; body: any }`
   - `extractStreamDelta(chunk: Buffer | string): string | null`
2. **`OpenAIAdapter`**:
   - Routes: `/v1/chat/completions`
   - Normalizes: `system` / `developer` messages, user/assistant history, function/tool definitions.
   - Reconstructs payload preserving model params (`temperature`, `max_tokens`, etc.).
3. **`AnthropicAdapter`**:
   - Routes: `/v1/messages`
   - Normalizes: top-level `system` prompt string/array, `messages` array, `tools` block.
   - Reconstructs compliant Anthropic JSON payload.

---

## 4. Ingress & Interception State Machine (`packages/core/src/proxy/`)
1. **`Interceptor`**:
   - Manages pending request map: `Map<string, { resolve: (action: InterceptorAction) => void; envelope: LensgateContextEnvelope }>`
   - Configurable timeout (default: 120s).
   - Mode support:
     - `observe`: Non-blocking broadcast to WebSocket; immediately forwards.
     - `control`: Pauses request resolution until UI approves/modifies or drops.
2. **`UpstreamDispatcher`**:
   - Routes requests to provider endpoints:
     - `https://api.openai.com`
     - `https://api.anthropic.com`
   - Forwards agent credentials (`Authorization`, `x-api-key`).
   - Supports non-streaming and Server-Sent Events (SSE) streaming with transparent chunk relay back to agent.

---

## 5. WebSocket Coordination Gateway (`packages/core/src/ws/`)
- Handles UI connection state.
- Broadcasts new intercepted requests with full `LensgateContextEnvelope`.
- Receives developer resolutions:
  - `FORWARD`: Send original request.
  - `MODIFY_AND_FORWARD`: Reconstruct upstream body from edited envelope and send.
  - `DROP`: Abort upstream call, return HTTP 403 or synthetic error to agent.

---

## 6. Verification & Test Suite
1. **Unit tests (`vitest`)**:
   - Round-trip fidelity: `OpenAI Payload -> Envelope -> OpenAI Payload` (assert identical AST).
   - Round-trip fidelity: `Anthropic Payload -> Envelope -> Anthropic Payload`.
2. **End-to-end integration test**:
   - Spin up local Lensgate proxy.
   - Mock upstream server simulating OpenAI/Anthropic responses.
   - Simulate client sending request in `control` mode.
   - Assert request pauses until simulated WS command delivers modification.
   - Assert upstream receives modified payload and client receives response stream.

