import { AuditResultType, AuditSource } from "./scorecard";

export type ReviewStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "IN_REVIEW"
  | "SUBMITTED"
  | "APPROVED"
  | "REOPENED"
  | "FINALIZED";

export type ReviewPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type ReviewAction = "AGREED" | "OVERRIDDEN";

export type OverrideReasonCategory =
  | "AI_MISSED_EVIDENCE"
  | "AI_MISINTERPRETED_EVIDENCE"
  | "TRANSCRIPT_ERROR"
  | "SPEAKER_MAPPING_ERROR"
  | "QA_RULE_INTERPRETATION"
  | "INCORRECT_FAILURE_REASON"
  | "INSUFFICIENT_CONTEXT"
  | "OTHER";

export type AIEvidenceAccuracy = "CORRECT" | "PARTIALLY_CORRECT" | "INCORRECT";

export type HumanEvaluationSource =
  | "AI_TRANSCRIPT"
  | "HUMAN_AUDIO"
  | "HUMAN_HYBRID"
  | "HUMAN_CRM";

export type DatasetSourceType =
  | "SYNTHETIC"
  | "REAL_VALIDATED"
  | "PRODUCTION_REVIEWED";

export type DatasetStatus = "DRAFT" | "FROZEN" | "ARCHIVED";

export type AIRecommendation =
  | "HIGH_CONFIDENCE_PASS"
  | "REVIEW_FAILURE"
  | "REVIEW_AMBIGUOUS"
  | "INSUFFICIENT_EVIDENCE";

export interface CalibrationDataset {
  id: string;
  organization_id: string;
  name: string;
  version: string;
  description?: string;
  dataset_source_type: DatasetSourceType;
  status: DatasetStatus;
  min_sample_size: number;
  created_at: string;
  frozen_at?: string;
}

export interface CalibrationDatasetItem {
  id: string;
  dataset_id: string;
  call_id: string;
  audit_id: string;
  review_id: string;
  transcript_id: string;
  created_at: string;
}

export interface MetricFraction {
  numerator: number;
  denominator: number;
  rate: number;
  display: string; // e.g. "28 / 30 = 93.3%"
}

export interface FalsePositiveRecord {
  callId: string;
  externalCallId: string;
  parameterId: string;
  parameterName: string;
  aiResult: string;
  humanResult: string;
  aiFailureReason?: string;
  humanFailureReason?: string;
  aiEvidence: string[];
  humanExplanation: string;
  promptVersion: string;
  overrideCategory: OverrideReasonCategory;
  rootCauseAnalysis: string;
  recommendedAction: string;
}

export interface HumanHumanAgreementMetrics {
  doubleReviewedCount: number;
  overallAgreement: MetricFraction;
  parameterAgreement: Array<{
    parameterId: string;
    parameterName: string;
    exactAgreements: MetricFraction;
  }>;
  failureReasonAgreement: MetricFraction;
}

export interface StoredAuditReview {
  id: string;
  audit_id: string;
  call_id: string;
  organization_id: string;
  version: number; // Optimistic locking
  reviewer_id?: string;
  reviewer_name?: string;
  assigned_by?: string;
  assigned_at?: string;
  due_at?: string;
  priority: ReviewPriority;
  status: ReviewStatus;
  original_ai_score: number;
  reviewed_score?: number;
  final_score?: number | null;
  is_passed?: boolean;
  reopen_reason?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
  decisions: StoredAuditResultOverride[];
}

export interface StoredAuditResultOverride {
  id: string;
  review_id: string;
  parameter_id: string;
  parameter_name: string;
  section_name: string;
  max_weight: number;
  review_action: ReviewAction;
  ai_result?: AuditResultType;
  human_result: AuditResultType;
  ai_awarded_points: number;
  human_awarded_points: number;
  ai_failure_reason?: string;
  human_failure_reason?: string;
  override_reason_category?: OverrideReasonCategory;
  override_notes?: string;
  ai_evidence_accuracy?: AIEvidenceAccuracy;
  human_evidence_utterance_ids: string[];
  evaluation_source: HumanEvaluationSource;
  crm_checked?: boolean;
  jira_checked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParameterDecisionInput {
  parameter_id: string;
  review_action: ReviewAction;
  human_result: AuditResultType;
  human_awarded_points: number;
  human_failure_reason?: string;
  override_reason_category?: OverrideReasonCategory;
  override_notes?: string;
  ai_evidence_accuracy?: AIEvidenceAccuracy;
  human_evidence_utterance_ids?: string[];
  evaluation_source?: HumanEvaluationSource;
  crm_checked?: boolean;
  jira_checked?: boolean;
}

export interface QAGoldLabel {
  id: string;
  dataset_id?: string;
  dataset_version?: string;
  call_id: string;
  review_id: string;
  transcript_id?: string;
  scorecard_id: string;
  scorecard_version: string;
  parameter_id: string;
  parameter_name: string;
  ai_result?: string;
  human_result: string;
  is_agreement: boolean;
  ai_failure_reason?: string;
  human_failure_reason?: string;
  failure_reason_agreement?: boolean;
  ai_confidence?: number;
  ai_evidence_accuracy?: AIEvidenceAccuracy;
  evidence_relevance?: "RELEVANT" | "PARTIALLY_RELEVANT" | "IRRELEVANT";
  evidence_sufficiency?: "SUFFICIENT" | "PARTIALLY_SUFFICIENT" | "INSUFFICIENT";
  ai_evidence: unknown[];
  human_evidence: unknown[];
  reviewer_id?: string;
  secondary_reviewer_id?: string;
  secondary_human_result?: string;
  secondary_failure_reason?: string;
  organization_id: string;
  created_at: string;
}

export interface ParameterAgreementMetric {
  parameterId: string;
  parameterName: string;
  totalEvaluated: number;
  exactAgreements: number;
  agreementRate: number;
  agreementFraction: MetricFraction;
  falseFailCount: number;
  falseFailRate: number;
  falseFailFraction: MetricFraction;
  falsePassCount: number;
  falsePassRate: number;
  falsePassFraction: MetricFraction;
  passCount: number;
  failCount: number;
  partialCount: number;
  failureReasonAgreementCount: number;
  failureReasonAgreementRate: number;
  failureReasonFraction: MetricFraction;
}

export interface CalibrationMetrics {
  datasetId?: string;
  datasetName: string;
  datasetVersion: string;
  datasetSourceType: DatasetSourceType;
  datasetStatus: DatasetStatus;
  isPreliminary: boolean;
  warningMessage?: string;
  minSampleSize: number;

  totalGoldAudits: number;
  totalAuditableCriteriaEvaluated: number;

  // Scalar backward-compatible percentages
  overallAgreementRate: number;
  failPrecision: number;
  failRecall: number;
  passPrecision: number;
  evidenceAccuracyRate: number;
  failureReasonAccuracyRate: number;

  // Exact fraction representations (Section 20)
  overallAgreement: MetricFraction;
  failPrecisionMetric: MetricFraction;
  failRecallMetric: MetricFraction;
  passPrecisionMetric: MetricFraction;
  evidenceAccuracyMetric: MetricFraction;
  failureReasonMetric: MetricFraction;

  evidenceAccuracyBreakdown: {
    correct: number;
    partiallyCorrect: number;
    incorrect: number;
    unrated: number;
  };

  parameterAgreement: ParameterAgreementMetric[];
  confidenceCalibration: Array<{
    bucket: string;
    count: number;
    agreements: number;
    agreementRate: number;
    fraction: MetricFraction;
  }>;

  humanHumanAgreement?: HumanHumanAgreementMetrics;
  falsePositiveAnalysis: FalsePositiveRecord[];

  totalTokensUsed: number;
  estimatedCostUsd: number;
  averageLatencyMs: number;
}
