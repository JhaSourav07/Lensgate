# Lensgate: Technical Architecture & Blueprint
### The Developer-Controlled Context Layer for AI Coding Agents

---

## 1. System Overview & Core Philosophy

Lensgate operates as a local-first control plane between AI coding agents (Antigravity, Claude Code, Cursor, Gemini CLI, OpenAI Codex) and upstream model providers (Anthropic, OpenAI, Google Gemini, Ollama, custom endpoints).

```
+-----------------------------------------------------------------------+
|                             Developer                                 |
+------------------------------------+----------------------------------+
                                     |
                       Observes / Edits / Approves
                                     v
+------------------------+      +-------------------+      +------------+
|    AI Coding Agent     | ---> |  Lensgate Engine  | ---> |   Model    |
| (Claude Code, Cursor,  |      |   (Port 8080)     |      |  Provider  |
|  Antigravity, etc.)    | <--- |  Proxy + Control  | <--- | (Upstream) |
+------------------------+      +---------+---------+      +------------+
                                          |
                              WebSocket / REST API
                                          v
                                +-------------------+
                                |    Lensgate UI    |
                                |   (Port 8081)     |
                                | Intercept / Diff  |
                                +-------------------+
```

---

## 2. Ingestion & Interception Modes

Lensgate supports two interception mechanisms:

### Mode A: Reverse Proxy / Base URL Redirection (Primary & Default)
- Requires zero root CA installation.
- AI agents configure provider base URLs to point to Lensgate:
  - `OPENAI_BASE_URL=http://localhost:8080/v1`
  - `ANTHROPIC_BASE_URL=http://localhost:8080`
  - `GEMINI_BASE_URL=http://localhost:8080`
- Provider autodetection via path prefix, headers (`x-api-key`, `anthropic-version`), or host header.

### Mode B: Forward HTTP/HTTPS MITM Proxy (Secondary)
- Used for CLI agents or IDE plugins that do not expose base URL settings.
- Standard `HTTP_PROXY` and `HTTPS_PROXY` environment variables.
- Lensgate generates and trusts a local root Certificate Authority (CA) on demand (`~/.lensgate/certs/ca.pem`).

---

## 3. Core Engine Architecture (Node.js & TypeScript)

```
lensgate/
├── packages/
│   ├── core/                    # Engine & Proxy Core
│   │   ├── src/
│   │   │   ├── proxy/           # HTTP/HTTPS & MITM listeners
│   │   │   │   ├── server.ts
│   │   │   │   ├── interceptor.ts
│   │   │   │   └── mitm-ca.ts
│   │   │   ├── adapters/        # Provider Normalizers
│   │   │   │   ├── base.ts
│   │   │   │   ├── openai.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   └── gemini.ts
│   │   │   ├── intelligence/    # Context Intelligence & Scanner
│   │   │   │   ├── scanner.ts
│   │   │   │   ├── detector.ts
│   │   │   │   └── rules-engine.ts
│   │   │   ├── tokens/          # Token Analytics & Estimators
│   │   │   │   ├── counter.ts
│   │   │   │   └── breakdown.ts
│   │   │   ├── storage/         # SQLite persistence & migrations
│   │   │   │   ├── db.ts
│   │   │   │   ├── schema.ts
│   │   │   │   └── repository.ts
│   │   │   └── ws/              # Real-time WebUI synchronization
│   │   │       └── gateway.ts
│   │   └── tsconfig.json
│   ├── ui/                      # Dashboard (Vite + React + Tailwind)
│   │   ├── src/
│   │   │   ├── components/      # Intercept, Diff, Inspector, Analytics
│   │   │   ├── hooks/
│   │   │   ├── store/
│   │   │   └── App.tsx
│   │   └── vite.config.ts
│   └── cli/                     # Developer CLI (`lensgate start`, etc.)
│       └── src/index.ts
├── package.json
└── pnpm-workspace.yaml
```

---

## 4. Universal Context Envelope (`LensgateContextEnvelope`)

All provider-specific payloads are normalized into a unified schema for inspection, editing, and rule application:

```typescript
export interface LensgateContextEnvelope {
  id: string;                      // Unique Request UUID
  timestamp: number;
  sessionToken: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'generic';
  model: string;
  stream: boolean;

  // Normalized Context Blocks
  context: {
    systemInstructions: Array<{
      id: string;
      source?: string;           // e.g. "CLAUDE.md", "system-prompt", "agent-rule"
      content: string;
      mutable: boolean;
    }>;
    projectPurpose?: {
      verified: string;          // Developer-defined truth
      inferred?: string;         // Agent's generated hypothesis
    };
    conversationTurns: Array<{
      id: string;
      role: 'user' | 'assistant' | 'tool' | 'system';
      content: string;
      toolCalls?: any[];
      toolOutputs?: any[];
    }>;
    codeAttachments: Array<{
      path: string;
      lineRange?: [number, number];
      content: string;
      tokenCount: number;
    }>;
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, any>;
    }>;
  };

  // Upstream Raw representation
  rawHeaders: Record<string, string | string[]>;
  rawBody: any;

  // Interception State
  status: 'intercepted' | 'forwarded' | 'modified' | 'dropped';
  verdict?: 'approved' | 'rejected' | 'auto-transformed';
  diff?: {
    originalBody: string;
    modifiedBody: string;
  };
}
```

---

## 5. Request Interception Lifecycle & State Machine

```
   [ Agent Outgoing Request ]
               |
               v
     [ Ingress Listener ]
               |
               v
     [ Provider Adapter ] -------> Parse to Universal Envelope
               |
               v
   [ Context Intelligence ] -----> Detect Misinterpretations / Conflicts
               |
               v
      { Mode Active? }
        /          \
   (Observe)      (Control)
      /              \
     /          { Intercept On? }
    /             /            \
   |            (Yes)          (No / Auto-Rule)
   |              |                   |
   |        Enqueue in UI        Apply Static Rules
   |      (Await Dev Action)          |
   |              |                   |
   |      [ Dev Forwards/Edits ]      |
   \              |                  /
    \             +-----------------+
     \                     |
      \                    v
       +---------> [ Upstream Dispatch ]
                           |
                           v
              [ Stream Interceptor (SSE) ]
                           |
                           v
        [ Response Recorder & Token Auditor ]
                           |
                           v
                 [ Return to Agent ]
```

### Operating Levels:
1. **Observe Mode**: Pass-through with zero latency overhead. Real-time stream mirroring to UI.
2. **Suggest Mode**: Pass-through with non-blocking alerts posted to UI notifications and history logs.
3. **Control Mode**: Halts execution. Request holds in state `intercepted` until developer sends `FORWARD`, `MODIFY_AND_FORWARD`, or `DROP` via WebSocket API.

---

## 6. Context Intelligence Engine

The intelligence layer runs three concurrent analyzers:

1. **Project Ground Truth Scanner**:
   - Walks project directory ignoring `.gitignore` paths.
   - Extracts repository purpose from `README.md`, `CLAUDE.md`, `.cursorrules`, architecture docs, `package.json`, and git commit messages.
   - Generates a **Verified Project Profile**.

2. **Misinterpretation & Drift Detector**:
   - Compares agent's system instructions and conversation assumptions against the Verified Project Profile.
   - Identifies high-risk divergences:
     - Negative security reframing (e.g. "attack tool" vs "authorized security framework").
     - Architectural drift (e.g. assuming outdated ORM or deprecated frameworks).
     - Conflicting rules between global developer rules and workspace instructions.

3. **Duplication & Waste Analyzer**:
   - Identifies duplicate file injections.
   - Flags giant test payloads or unoptimized conversation histories exceeding token efficiency limits.

---

## 7. Token Intelligence & Optimization

- Integrates fast BPE token estimation (`tiktoken` for OpenAI, `@anthropic-ai/tokenizer` for Anthropic, and character/byte heuristic fallbacks for Gemini).
- Real-time token breakdown per category:
  - System Prompts & Instructions %
  - Conversation History %
  - Code & Context Attachments %
  - Tool Definitions %
- Pre- and Post-Modification Comparison:
  - Exact token delta and cost projection before forwarding.

---

## 8. Storage & Audit Architecture

Embedded SQLite database using WAL mode for zero-latency concurrent reads/writes:

### Schema Definitions:
- **`sessions`**: Active coding agent sessions, detected tools, and active workspace paths.
- **`requests`**: Complete log of every intercepted call (timestamps, provider, model, latency, status).
- **`envelopes`**: Serialized `LensgateContextEnvelope` capturing original context vs modified context.
- **`modifications`**: Audit trail of every field edited by developer (who, what, old text, new text, timestamp).
- **`project_profiles`**: Cached project architecture, verified purpose, and override rules.
- **`rules`**: Persistent mutation rules (e.g. "Always replace 'brute force tool' with verified security framework declaration").

---

## 9. Dashboard UI Architecture (Vite + React + Tailwind + Monaco)

- **Intercept View**:
  - Split-pane layout: Original Context vs Editable Request.
  - Quick action bar: **Forward (Ctrl+Enter)**, **Drop (Esc)**, **Apply Purpose Override**, **Format JSON**.
  - Side-by-side Monaco Diff Editor.
- **Context Inspector**:
  - Collapsible semantic trees for:
    - Injected System Instructions
    - Project Rules
    - Retrieved Code Files
    - Conversation Turns
- **Intelligence Alerts Drawer**:
  - Warnings flagged by the intelligence engine with 1-click auto-fix actions.
- **Token Breakdown Visualizer**:
  - Horizontal stacked bar showing token density by category.
- **History & Replay**:
  - Timeline of all requests with search, filter by provider/model, and replay capability.

---

## 10. Implementation Roadmap

| Phase | Milestone | Deliverables |
|---|---|---|
| **Phase 1** | **Proxy Core & Envelope Normalizer** | Fastify proxy server, Anthropic & OpenAI adapters, WebSocket bus. |
| **Phase 2** | **Intercept & Inspection UI** | Vite + React dashboard, Monaco diff editor, Pause/Forward pipeline. |
| **Phase 3** | **Context Intelligence & Scanner** | Local repo analyzer, purpose mismatch detector, rule auto-replacements. |
| **Phase 4** | **Token Intelligence & SQLite History** | Tokenizer breakdown, persistent audit trail, exportable session logs. |

