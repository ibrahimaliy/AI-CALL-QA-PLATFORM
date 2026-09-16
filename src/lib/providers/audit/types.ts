import { AuditSource, AuditResultType } from "@/types/scorecard";

export type VerbiageRequirementType = "EXACT" | "SEMANTIC" | "SUGGESTED";

export interface AuditVerbiageTarget {
  context: string;
  suggestedText: string;
  requirementType: VerbiageRequirementType;
}

export interface AuditRuleTarget {
  id: string;
  title: string;
  description?: string;
  ruleType: string;
  auditSource: AuditSource;
}

export interface AuditFailureReasonTarget {
  code: string;
  label: string;
  description?: string;
}

export interface AuditParameterTarget {
  parameterId: string;
  parameterName: string;
  sectionName: string;
  maxWeight: number;
  description: string;
  auditSource: AuditSource;
  rules: AuditRuleTarget[];
  failureReasons: AuditFailureReasonTarget[];
  approvedVerbiage: AuditVerbiageTarget[];
}

export interface AuditTranscriptLine {
  promptId: string; // e.g. "U0001"
  speakerRole: "AGENT" | "CUSTOMER" | "UNKNOWN";
  speakerLabel: string;
  timestampText: string; // e.g. "00:00.820 - 00:04.320"
  text: string; // PII-sanitized text
}

export interface EphemeralEvidenceMapping {
  promptId: string; // "U0001"
  utteranceId: string; // Real DB UUID
  startMs: number;
  endMs: number;
  speakerRole: string;
  text: string;
}

export interface AuditContext {
  callId: string;
  organizationId: string;
  scorecardId: string;
  scorecardName: string;
  scorecardVersion: string;
  transcriptId: string;
  transcriptVersion: number;
  availableSources: AuditSource[];
  targetParameters: AuditParameterTarget[];
  transcriptLines: AuditTranscriptLine[];
  evidenceIdMap: Record<string, EphemeralEvidenceMapping>;
  inputHash: string;
  promptVersion: string;
}

export interface NormalizedParameterFinding {
  parameterId: string;
  result: AuditResultType;
  confidence: number;
  failureReasonCodes: string[];
  reason: string;
  evidenceUtteranceIds: string[]; // e.g. ["U0001"]
  requiresHumanReview: boolean;
}

export interface NormalizedAuditResult {
  provider: string;
  model: string;
  promptVersion: string;
  summary: string;
  parameters: NormalizedParameterFinding[];
  strengths: string[];
  improvementAreas: string[];
  requestTokenCount?: number;
  responseTokenCount?: number;
  responseId?: string;
  rawResponse?: unknown;
}

export interface AIAuditProvider {
  readonly name: string;
  evaluateAudit(context: AuditContext): Promise<NormalizedAuditResult>;
  healthCheck?(): Promise<boolean>;
}
