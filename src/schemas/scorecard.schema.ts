import { z } from "zod";

export const AuditSourceSchema = z.enum([
  "TRANSCRIPT",
  "AUDIO",
  "KNOWLEDGE_BASE",
  "CRM",
  "HYBRID",
  "MANUAL",
]);

export const AuditResultTypeSchema = z.enum([
  "PASS",
  "PARTIAL",
  "FAIL",
  "REVIEW_REQUIRED",
  "NOT_APPLICABLE",
]);

export const CustomerSentimentSchema = z.enum([
  "POSITIVE",
  "NEUTRAL",
  "NEGATIVE",
  "MIXED",
  "FRUSTRATED",
]);

export const ResolutionStatusSchema = z.enum([
  "RESOLVED",
  "UNRESOLVED",
  "ESCALATED",
  "PENDING_CUSTOMER",
]);

const UUIDSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format");

// Rule Schema
export const ScorecardRuleSchema = z.object({
  id: UUIDSchema.optional(),
  parameter_id: UUIDSchema,
  title: z.string().min(3),
  description: z.string().optional(),
  rule_type: z.enum(["STANDARD", "COMPLIANCE", "ACCURACY", "OPERATIONAL"]).default("STANDARD"),
  audit_source: AuditSourceSchema,
  knowledge_requirement: z.string().optional(),
  allocated_points: z.number().nonnegative().optional(),
  sort_order: z.number().int().default(0),
  active: z.boolean().default(true),
});

// Failure Reason Schema
export const FailureReasonSchema = z.object({
  id: UUIDSchema.optional(),
  parameter_id: UUIDSchema,
  code: z.string().min(2),
  label: z.string().min(2), // Original workbook wording
  description: z.string().optional(),
  active: z.boolean().default(true),
});

// Parameter Schema
export const ScorecardParameterSchema = z.object({
  id: UUIDSchema.optional(),
  scorecard_id: UUIDSchema.optional(),
  section_name: z.string().min(2),
  parameter_name: z.string().min(2),
  description: z.string(),
  max_weight: z.number().positive().max(100),
  audit_source: AuditSourceSchema,
  sort_order: z.number().int().default(0),
  is_critical: z.boolean().default(false),
  critical_failure_effect: z.string().optional(),
  active: z.boolean().default(true),
  rules: z.array(ScorecardRuleSchema).optional(),
  failure_reasons: z.array(FailureReasonSchema).optional(),
});

// Verbiage Guideline Schema
export const VerbiageGuidelineSchema = z.object({
  id: UUIDSchema.optional(),
  scorecard_id: UUIDSchema.optional(),
  parameter: z.string(),
  language: z.string().default("English"),
  suggested_verbiage: z.string().min(5),
  reference_guideline: z.string().optional(),
  active: z.boolean().default(true),
});

// Full Scorecard Validation Schema (verifies parameters sum to 100)
export const ScorecardDefinitionSchema = z.object({
  id: UUIDSchema.optional(),
  name: z.string().min(3),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+$/),
  passing_score: z.number().min(0).max(100).default(71),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  parameters: z.array(ScorecardParameterSchema).refine(
    (params) => {
      const sum = params.reduce((acc, p) => acc + p.max_weight, 0);
      return Math.abs(sum - 100) < 0.001;
    },
    {
      message: "The sum of all parameter maximum weights must equal exactly 100.",
    }
  ),
  verbiage_guidelines: z.array(VerbiageGuidelineSchema).optional(),
});

// AI Structured Output Schema (Section 30 of Specification)
export const AIPredictedParameterResultSchema = z.object({
  parameterId: z.string(),
  result: AuditResultTypeSchema,
  recommendedPoints: z.number().min(0),
  maxPoints: z.number().positive(),
  confidence: z.number().min(0).max(1),
  failureReasonCode: z.string().nullable().optional(),
  reason: z.string().min(5),
  evidenceUtteranceIds: z.array(z.string()).default([]),
  requiresHumanReview: z.boolean().default(false),
}).refine(
  (data) => data.recommendedPoints <= data.maxPoints,
  {
    message: "recommendedPoints cannot exceed maxPoints for any parameter.",
    path: ["recommendedPoints"],
  }
);

export const AIAuditResponseSchema = z.object({
  callSummary: z.string().min(10),
  customerSentiment: CustomerSentimentSchema,
  resolutionStatus: ResolutionStatusSchema,
  requiresHumanReview: z.boolean(),
  parameters: z.array(AIPredictedParameterResultSchema),
  strengths: z.array(z.string()).default([]),
  improvementAreas: z.array(z.string()).default([]),
});

export type AIPredictedParameterResult = z.infer<typeof AIPredictedParameterResultSchema>;
export type AIAuditResponse = z.infer<typeof AIAuditResponseSchema>;
