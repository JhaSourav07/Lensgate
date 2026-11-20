import {
  LensgateContextEnvelope,
  VerifiedProjectProfile,
  IntelligenceAlert,
} from '@lensgate/shared';
import { v4 as uuidv4 } from 'uuid';

const SECRET_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: 'OpenAI API Key', regex: /sk-(?:proj-)?[a-zA-Z0-9_-]{24,}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_-]{24,}/g },
  { name: 'Google API Key', regex: /AIzaSy[a-zA-Z0-9_-]{33}/g },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'JWT Bearer Token', regex: /Bearer\s+eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/g },
];

export class IntelligenceDetector {
  analyze(
    envelope: LensgateContextEnvelope,
    profile?: VerifiedProjectProfile | null
  ): IntelligenceAlert[] {
    const alerts: IntelligenceAlert[] = [];

    // Extract text from conversation turns and system instructions
    const turns = envelope.context.conversationTurns || [];
    const systemBlocks = envelope.context.systemInstructions || [];
    const codeAttachments = envelope.context.codeAttachments || [];

    const turnsText = turns
      .map((t) => (typeof t.content === 'string' ? t.content : JSON.stringify(t.content)))
      .join('\n');
    const systemText = systemBlocks.map((s) => s.content).join('\n');
    const fullContextText = `${systemText}\n${turnsText}`;

    // 1. Secret / Credential Leakage Check (Critical)
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(fullContextText);
      if (match) {
        alerts.push({
          id: uuidv4(),
          type: 'security',
          severity: 'critical',
          title: `Credential Leak Detected (${pattern.name})`,
          message: `Active context contains an exposed ${pattern.name} ("${match[0].slice(0, 8)}..."). Forwarding will leak keys to model providers.`,
          evidence: match[0],
          suggestedFix: {
            action: 'sanitize',
            description: `Redact ${pattern.name} occurrences with [REDACTED_SECRET] before forwarding`,
          },
        });
      }
    }

    // 2. Misinterpretation & Safety Refusal Risk (High)
    // Check if prompt uses sensitive terminology but lacks a purpose lock
    const lowerContext = fullContextText.toLowerCase();
    const sensitiveTerms = profile?.sensitiveTerms?.length
      ? profile.sensitiveTerms
      : ['mitm', 'interception', 'bypass', 'exploit', 'reverse engineer', 'hack', 'packet capture'];

    const matchedTerms = sensitiveTerms.filter((term) =>
      lowerContext.includes(term.toLowerCase())
    );

    const hasPurposeLock =
      lowerContext.includes('[verified project purpose]') ||
      lowerContext.includes('verified purpose:') ||
      Boolean(envelope.context.projectPurpose?.verified);

    if (matchedTerms.length > 0 && !hasPurposeLock) {
      alerts.push({
        id: uuidv4(),
        type: 'misinterpretation',
        severity: 'high',
        title: 'Safety Refusal / Misinterpretation Risk',
        message: `Context mentions sensitive terms (${matchedTerms.map((t) => `"${t}"`).join(', ')}) without a Verified Purpose Lock. AI models may refuse the prompt or generate misguided safety warnings.`,
        evidence: `Matched: ${matchedTerms.join(', ')}`,
        suggestedFix: {
          action: 'purpose_lock',
          description: profile?.verifiedPurpose
            ? `Lock context with verified purpose: "${profile.verifiedPurpose.slice(0, 60)}..."`
            : 'Prepend an authorized developer Purpose Lock to guarantee correct context framing',
        },
      });
    }

    // 3. Context History Bloat & Latency Risk (Medium)
    const totalChars = fullContextText.length;
    const estimatedTokens = Math.round(totalChars / 4);

    if (turns.length > 15 || estimatedTokens > 16000) {
      alerts.push({
        id: uuidv4(),
        type: 'bloat',
        severity: estimatedTokens > 32000 ? 'high' : 'medium',
        title: 'Severe Context Bloat',
        message: `Session has accumulated ${turns.length} turns (~${estimatedTokens.toLocaleString()} tokens). Long context windows increase latency, cost, and instruction drift.`,
        evidence: `${turns.length} turns, ${totalChars} characters`,
        suggestedFix: {
          action: 'prune_context',
          description: 'Prune conversation history keeping only system instructions and the last 6 turns',
        },
      });
    }

    // 4. Duplicate System Instructions (Low)
    if (systemBlocks.length > 1) {
      const uniqueContents = new Set(systemBlocks.map((s) => s.content.trim()));
      if (uniqueContents.size < systemBlocks.length) {
        alerts.push({
          id: uuidv4(),
          type: 'bloat',
          severity: 'low',
          title: 'Duplicate System Instruction Detected',
          message: 'Multiple identical system instruction blocks are wasting token context budget.',
          suggestedFix: {
            action: 'prune_context',
            description: 'Deduplicate redundant system instruction blocks',
          },
        });
      }
    }

    return alerts;
  }
}

