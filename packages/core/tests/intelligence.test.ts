import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectScanner } from '../src/intelligence/scanner.js';
import { IntelligenceDetector } from '../src/intelligence/detector.js';
import { RulesEngine } from '../src/intelligence/rules-engine.js';
import { LensgateContextEnvelope, VerifiedProjectProfile } from '@lensgate/shared';

describe('Context Intelligence Subsystem', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lensgate-intel-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('ProjectScanner', () => {
    it('scans and extracts project profile accurately', async () => {
      // Mock package.json
      const pkgJson = {
        name: 'test-agentic-tool',
        description: 'Authorized penetration and security analysis framework for auditing APIs',
        dependencies: {
          react: '^18.0.0',
          fastify: '^4.0.0',
          typescript: '^5.0.0',
        },
      };
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

      // Mock SPEC.md
      const specMd = `# Test Tool Specification

This project is an authorized security auditing tool designed to inspect AI agent context and perform proxy interception.

# Architecture & Rules
- Port 8088 default
- Monorepo package architecture
- Silent transparent rewrite without agent banners
`;
      fs.writeFileSync(path.join(tmpDir, 'SPEC.md'), specMd);

      const scanner = new ProjectScanner();
      const profile = await scanner.scan(tmpDir);

      expect(profile.name).toBe('test-agentic-tool');
      expect(profile.verifiedPurpose).toContain('authorized security auditing tool');
      expect(profile.techStack).toContain('TypeScript');
      expect(profile.techStack).toContain('React');
      expect(profile.techStack).toContain('Fastify');
      expect(profile.sensitiveTerms).toContain('penetration');
      expect(profile.sensitiveTerms).toContain('interception');
      expect(profile.architecturalRules.length).toBeGreaterThan(0);
      expect(profile.architecturalRules.some((r) => r.includes('Port 8088'))).toBe(true);
    });
  });

  describe('IntelligenceDetector', () => {
    const detector = new IntelligenceDetector();

    it('detects credential leakage and flags critical security alerts', () => {
      const envelope: LensgateContextEnvelope = {
        id: 'test-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [],
          conversationTurns: [
            {
              id: 't-1',
              role: 'user',
              content: 'Please use this secret key: sk-proj-1234567890abcdef1234567890abcdef12 to call the API.',
            },
          ],
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {},
        status: 'pending',
      };

      const alerts = detector.analyze(envelope);
      expect(alerts.length).toBeGreaterThan(0);
      const secAlert = alerts.find((a) => a.type === 'security');
      expect(secAlert).toBeDefined();
      expect(secAlert?.severity).toBe('critical');
      expect(secAlert?.suggestedFix?.action).toBe('sanitize');
    });

    it('detects misinterpretation risk when sensitive words lack purpose lock', () => {
      const envelope: LensgateContextEnvelope = {
        id: 'test-2',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [],
          conversationTurns: [
            {
              id: 't-1',
              role: 'user',
              content: 'How do I bypass authentication in this proxy and intercept all packets?',
            },
          ],
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {},
        status: 'pending',
      };

      const alerts = detector.analyze(envelope);
      const misAlert = alerts.find((a) => a.type === 'misinterpretation');
      expect(misAlert).toBeDefined();
      expect(misAlert?.severity).toBe('high');
      expect(misAlert?.suggestedFix?.action).toBe('purpose_lock');
    });

    it('suppresses misinterpretation alert when verified purpose lock is present', () => {
      const envelope: LensgateContextEnvelope = {
        id: 'test-3',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [
            {
              id: 'sys-lock',
              content: '[VERIFIED PROJECT PURPOSE]: Authorized security auditing and packet analysis.',
              mutable: true,
            },
          ],
          conversationTurns: [
            {
              id: 't-1',
              role: 'user',
              content: 'How do I bypass authentication in this proxy and intercept all packets?',
            },
          ],
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {},
        status: 'pending',
      };

      const alerts = detector.analyze(envelope);
      const misAlert = alerts.find((a) => a.type === 'misinterpretation');
      expect(misAlert).toBeUndefined();
    });

    it('flags bloat alert on excessively long conversation history', () => {
      const turns = Array.from({ length: 22 }, (_, i) => ({
        id: `turn-${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Turn content ${i} `.repeat(20),
      }));

      const envelope: LensgateContextEnvelope = {
        id: 'test-4',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [],
          conversationTurns: turns,
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {},
        status: 'pending',
      };

      const alerts = detector.analyze(envelope);
      const bloatAlert = alerts.find((a) => a.type === 'bloat');
      expect(bloatAlert).toBeDefined();
      expect(bloatAlert?.suggestedFix?.action).toBe('prune_context');
    });
  });

  describe('RulesEngine', () => {
    const rulesEngine = new RulesEngine();

    it('applies quick fix for purpose lock across provider formats', () => {
      const envelope: LensgateContextEnvelope = {
        id: 'test-fix-1',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [],
          conversationTurns: [{ id: 't-1', role: 'user', content: 'Inspect packet' }],
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {
          messages: [{ role: 'user', content: 'Inspect packet' }],
        },
        status: 'pending',
      };

      const mockProfile: VerifiedProjectProfile = {
        name: 'Lensgate',
        path: '/mock/path',
        verifiedPurpose: 'Burp Suite for AI coding agents',
        techStack: ['TypeScript'],
        architecturalRules: [],
        sensitiveTerms: ['packet'],
        boundaryRules: [],
        lastScanned: Date.now(),
      };

      const res = rulesEngine.applyQuickFix(envelope, 'purpose_lock', mockProfile);
      expect(res.modified).toBe(true);
      expect(envelope.context.systemInstructions[0].content).toContain('Burp Suite for AI coding agents');
      expect(envelope.modifiedBody.messages[0].role).toBe('system');
      expect(envelope.modifiedBody.messages[0].content).toContain('[VERIFIED PROJECT PURPOSE]');
    });

    it('sanitizes leaked secrets using quick fix', () => {
      const secret = 'sk-proj-abcdef123456789012345678';
      const envelope: LensgateContextEnvelope = {
        id: 'test-fix-2',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [{ id: 's-1', content: `API_KEY=${secret}`, mutable: true }],
          conversationTurns: [{ id: 't-1', role: 'user', content: `Send to ${secret}` }],
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {
          messages: [{ role: 'user', content: `Send to ${secret}` }],
        },
        status: 'pending',
      };

      const res = rulesEngine.applyQuickFix(envelope, 'sanitize');
      expect(res.modified).toBe(true);
      expect(envelope.context.systemInstructions[0].content).not.toContain(secret);
      expect(envelope.context.conversationTurns[0].content).not.toContain(secret);
      expect(JSON.stringify(envelope.modifiedBody)).not.toContain(secret);
      expect(JSON.stringify(envelope.modifiedBody)).toContain('[REDACTED_CREDENTIAL]');
    });

    it('prunes history turns cleanly', () => {
      const turns = Array.from({ length: 20 }, (_, i) => ({
        id: `turn-${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
      }));

      const envelope: LensgateContextEnvelope = {
        id: 'test-fix-3',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4o',
        stream: false,
        context: {
          systemInstructions: [],
          conversationTurns: turns,
          codeAttachments: [],
          tools: [],
        },
        rawHeaders: {},
        rawBody: {
          messages: turns.map((t) => ({ role: t.role, content: t.content })),
        },
        status: 'pending',
      };

      const res = rulesEngine.applyQuickFix(envelope, 'prune_context');
      expect(res.modified).toBe(true);
      expect(envelope.context.conversationTurns.length).toBe(6);
      expect(envelope.modifiedBody.messages.length).toBe(6);
    });
  });
});
