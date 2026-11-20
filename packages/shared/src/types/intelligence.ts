export type AlertType = 'misinterpretation' | 'contradiction' | 'bloat' | 'security';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SuggestedFix {
  description: string;
  action: 'purpose_lock' | 'prune_context' | 'sanitize' | 'custom_patch';
  patch?: any;
}

export interface IntelligenceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  evidence?: string;
  suggestedFix?: SuggestedFix;
}

export interface VerifiedProjectProfile {
  name: string;
  path: string;
  verifiedPurpose: string;
  techStack: string[];
  architecturalRules: string[];
  sensitiveTerms: string[];
  boundaryRules: string[];
  lastScanned: number;
}

export type RuleType = 'purpose_lock' | 'regex_replace' | 'rule_enforcement' | 'prune_turns';

export interface ContextCorrectionRule {
  id: string;
  name: string;
  description?: string;
  type: RuleType;
  pattern: string;
  replacement: string;
  active: boolean;
  autoApply: boolean;
}

