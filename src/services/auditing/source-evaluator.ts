import { AuditSource, AuditResultType, ScorecardParameter } from "@/types/scorecard";

export interface ParameterAuditingEligibility {
  parameterId: string;
  parameterName: string;
  auditSource: AuditSource;
  maxWeight: number;
  isAuditable: boolean;
  defaultResult: AuditResultType;
  reason: string;
}

/**
 * Determines whether a parameter can be evaluated based on the currently available evidence sources.
 * Implements Specification Section 15 and Phase 1.1 Requirement 4 (Non-interchangeable source semantics).
 */
export function evaluateParameterEligibility(
  parameters: ScorecardParameter[],
  availableSources: AuditSource[]
): {
  eligibleParameters: ParameterAuditingEligibility[];
  totalAuditableWeight: number;
  totalUnAuditedWeight: number;
} {
  const eligibleParameters: ParameterAuditingEligibility[] = [];
  let totalAuditableWeight = 0;
  let totalUnAuditedWeight = 0;

  for (const param of parameters) {
    const isSourceAvailable = availableSources.includes(param.audit_source);

    if (isSourceAvailable) {
      eligibleParameters.push({
        parameterId: param.id,
        parameterName: param.parameter_name,
        auditSource: param.audit_source,
        maxWeight: param.max_weight,
        isAuditable: true,
        defaultResult: "PASS", // will be actively graded by AI
        reason: `Evidence source [${param.audit_source}] is available for automated evaluation.`,
      });
      totalAuditableWeight += param.max_weight;
    } else {
      // Source missing (e.g. AUDIO or CRM missing when only TRANSCRIPT is available)
      eligibleParameters.push({
        parameterId: param.id,
        parameterName: param.parameter_name,
        auditSource: param.audit_source,
        maxWeight: param.max_weight,
        isAuditable: false,
        defaultResult: "REVIEW_REQUIRED",
        reason: `Required audit source [${param.audit_source}] is unavailable. Marked REVIEW_REQUIRED per Section 15 & 24.`,
      });
      totalUnAuditedWeight += param.max_weight;
    }
  }

  return {
    eligibleParameters,
    totalAuditableWeight: Number(totalAuditableWeight.toFixed(2)),
    totalUnAuditedWeight: Number(totalUnAuditedWeight.toFixed(2)),
  };
}
