// TypeScript Definitions for QA Scorecard & Call Upload System
// Corresponds to DB Schema & Business Specification (Phase 1.1 & Phase 2)

export type AuditSource =
  | "TRANSCRIPT"
  | "AUDIO"
  | "KNOWLEDGE_BASE"
  | "CRM"
  | "HYBRID"
  | "MANUAL";

export type ScorecardStatus = "draft" | "published" | "archived";

export type AuditResultType =
  | "PASS"
  | "PARTIAL"
  | "FAIL"
  | "REVIEW_REQUIRED"
  | "NOT_APPLICABLE";

export type AppRole =
  | "ADMIN"
  | "QA_MANAGER"
  | "QA_AUDITOR"
  | "SUPERVISOR"
  | "VIEWER"
  | "AGENT";

export type CallProcessingStatus =
  | "PENDING_UPLOAD"
  | "UPLOADING"
  | "UPLOADED"
  | "TRANSCRIBING"
  | "TRANSCRIBED"
  | "AUDITING"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ProcessingStage =
  | "UPLOAD"
  | "TRANSCRIPTION"
  | "DIARIZATION"
  | "AUDIT"
  | "SCORING"
  | "REVIEW";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: AppRole;
  active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface ScorecardRule {
  id: string;
  parameter_id: string;
  title: string;
  description?: string;
  rule_type: "STANDARD" | "COMPLIANCE" | "ACCURACY" | "OPERATIONAL";
  audit_source: AuditSource;
  knowledge_requirement?: string;
  allocated_points?: number;
  sort_order: number;
  active: boolean;
}

export interface FailureReason {
  id: string;
  parameter_id: string;
  code: string;
  label: string; // Original workbook wording preserved
  description?: string;
  active: boolean;
}

export interface ScorecardParameter {
  id: string;
  scorecard_id: string;
  section_name: string;
  parameter_name: string;
  description: string;
  max_weight: number;
  audit_source: AuditSource;
  sort_order: number;
  is_critical: boolean;
  critical_failure_effect?: string;
  active: boolean;
  rules?: ScorecardRule[];
  failure_reasons?: FailureReason[];
}

export interface VerbiageGuideline {
  id: string;
  scorecard_id: string;
  parameter:
    | "Opening"
    | "Security Checks"
    | "Hold"
    | "Empathy"
    | "Escalation"
    | "Closing"
    | "System Downtime"
    | string;
  language: string;
  suggested_verbiage: string;
  reference_guideline?: string;
  active: boolean;
}

export interface ScorecardWithDetails {
  id: string;
  organization_id: string;
  campaign_id?: string;
  name: string;
  description?: string;
  version: string;
  passing_score: number;
  status: ScorecardStatus;
  effective_from?: string;
  effective_to?: string;
  parameters: ScorecardParameter[];
  verbiage_guidelines: VerbiageGuideline[];
}

export interface ParameterScoringInput {
  parameterId: string;
  maxWeight: number;
  awardedPoints: number;
  result: AuditResultType;
  auditSource: AuditSource;
  reason?: string;
  failureReasonCode?: string;
  evidenceUtteranceIds?: string[];
  requiresHumanReview: boolean;
}

export interface ScoringResult {
  totalPossibleScore: number;
  auditedScore: number;
  auditableWeight: number;
  provisionalPercentage: number;
  finalScore: number | null;
  passingScore: number;
  isPassed: boolean;
  requiresHumanReview: boolean;
  hasCriticalFailure: boolean;
  unAuditedWeight: number;
  summaryText: string;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  campaign_id: string;
  agent_id: string;
  scorecard_id: string;
  external_call_id?: string | null;
  client_request_id?: string | null;
  jira_transaction_number?: string | null;
  customer_phone_masked?: string | null;
  interaction_date: string;
  interaction_time: string;
  issue_type: string;
  query_count: number;
  audio_storage_path?: string | null;
  original_filename?: string | null;
  audio_content_type?: string | null;
  audio_size_bytes?: number | null;
  recording_checksum?: string | null;
  duration_seconds?: number | null;
  audio_duration_ms?: number | null;
  language: string;
  processing_status: CallProcessingStatus;
  processing_error?: string | null;
  uploaded_at?: string | null;
  created_at: string;
  updated_at: string;
  agent_name?: string;
  campaign_name?: string;
  scorecard_name?: string;
}

export interface ProcessingEventRecord {
  id: string;
  call_id: string;
  stage: ProcessingStage;
  status: string; // 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
  message: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
