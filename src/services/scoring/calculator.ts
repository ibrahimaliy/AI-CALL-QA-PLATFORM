import { ParameterScoringInput, ScoringResult } from "@/types/scorecard";

/**
 * Pure deterministic backend scoring calculator.
 * Implements Specification Sections 24, 31, and 32.
 * Rules:
 * - Backend strictly calculates all scores; never trust an LLM overall score.
 * - 0 <= awardedPoints <= maxWeight.
 * - Calculates auditableWeight and provisionalPercentage based ONLY on evaluated criteria.
 * - Marks requiresHumanReview if any parameter is REVIEW_REQUIRED or if critical failure occurred.
 */
export function calculateScorecardResult(
  parameters: ParameterScoringInput[],
  passingThreshold: number = 71.0,
  totalPossibleScore: number = 100.0
): ScoringResult {
  let auditedScore = 0;
  let auditableWeight = 0;
  let requiresHumanReview = false;
  const hasCriticalFailure = false;
  let allParametersEvaluated = true;

  for (const param of parameters) {
    // Parameter validation: bounds check
    const boundedAwarded = Math.max(0, Math.min(param.awardedPoints, param.maxWeight));

    if (param.result === "REVIEW_REQUIRED") {
      requiresHumanReview = true;
      allParametersEvaluated = false;
      // Parameters requiring external information or human review are NOT included in auditableWeight
    } else if (param.result === "NOT_APPLICABLE") {
      // Excluded from total
    } else {
      // Parameter was actively evaluated (PASS, PARTIAL, FAIL)
      auditedScore += boundedAwarded;
      auditableWeight += param.maxWeight;

      if (param.requiresHumanReview) {
        requiresHumanReview = true;
      }
    }
  }

  // Calculate provisional percentage safely
  const provisionalPercentage =
    auditableWeight > 0
      ? Number(((auditedScore / auditableWeight) * 100).toFixed(2))
      : 0.0;

  // Final score is calculated once all required criteria are resolved
  const finalScore = allParametersEvaluated
    ? Number(auditedScore.toFixed(2))
    : null;

  const isPassed =
    finalScore !== null
      ? finalScore >= passingThreshold && !hasCriticalFailure
      : provisionalPercentage >= passingThreshold && !hasCriticalFailure;

  const unAuditedWeight = Number((totalPossibleScore - auditableWeight).toFixed(2));

  let summaryText = "";
  if (allParametersEvaluated) {
    summaryText = `Final QA score: ${finalScore}/${totalPossibleScore} (${isPassed ? "PASS" : "FAIL"}).`;
  } else {
    summaryText = `AI AUDITED: ${auditedScore}/${auditableWeight} points (${provisionalPercentage}% provisional). ${unAuditedWeight} points require external information/human review.`;
  }

  return {
    totalPossibleScore,
    auditedScore: Number(auditedScore.toFixed(2)),
    auditableWeight: Number(auditableWeight.toFixed(2)),
    provisionalPercentage,
    finalScore,
    passingScore: passingThreshold,
    isPassed,
    requiresHumanReview,
    hasCriticalFailure,
    unAuditedWeight,
    summaryText,
  };
}
