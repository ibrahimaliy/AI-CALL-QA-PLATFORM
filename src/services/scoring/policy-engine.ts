import {
  ParameterScoringInput,
  ScoringResult,
  ScorecardWithDetails,
  ScorecardParameter,
} from "@/types/scorecard";
import { NormalizedParameterFinding } from "@/lib/providers/audit/types";
import { calculateScorecardResult } from "./calculator";

export type ScoringPolicyMode =
  | "BINARY"
  | "RULE_WEIGHTED"
  | "DEDUCTION"
  | "RUBRIC"
  | "MANUAL";

export interface ParameterScoringPolicy {
  parameterId: string;
  mode: ScoringPolicyMode;
  config: Record<string, unknown>;
}

import { getGlobalStores } from "@/lib/store/global-store";

// Global persistent policy registry
const scoringPoliciesRegistry = getGlobalStores().scoringPolicies;

// Default standard policies for Smile Telecom Scorecard parameters
// Binary: PASS gives maxWeight, FAIL gives 0.
export function registerDefaultScoringPolicies(parameters: ScorecardParameter[]): void {
  for (const p of parameters) {
    if (!scoringPoliciesRegistry.has(p.id)) {
      scoringPoliciesRegistry.set(p.id, {
        parameterId: p.id,
        mode: "BINARY",
        config: {
          passPoints: p.max_weight,
          failPoints: 0,
        },
      });
    }
  }
}

export class ScoringPolicyEngine {
  /**
   * Translates validated AI findings into deterministic parameter scores.
   * Specification Sections 4, 5, 28, 29, 30, 31, 32
   */
  static evaluateScorecard(
    scorecard: ScorecardWithDetails,
    aiFindings: NormalizedParameterFinding[],
    availableSources: string[] = ["TRANSCRIPT"]
  ): {
    scoringResult: ScoringResult;
    parameterResults: ParameterScoringInput[];
  } {
    // Ensure default policies exist
    registerDefaultScoringPolicies(scorecard.parameters);

    const parameterResults: ParameterScoringInput[] = [];
    const aiFindingsMap = new Map<string, NormalizedParameterFinding>();
    aiFindings.forEach((f) => aiFindingsMap.set(f.parameterId, f));

    for (const param of scorecard.parameters) {
      const isSourceAvailable = availableSources.includes(param.audit_source);
      const aiFinding = aiFindingsMap.get(param.id);

      if (isSourceAvailable && aiFinding) {
        // AI evaluated this parameter
        const policy = scoringPoliciesRegistry.get(param.id) || {
          parameterId: param.id,
          mode: "BINARY" as const,
          config: { passPoints: param.max_weight, failPoints: 0 },
        };

        const awarded = this.computeAwardedPoints(param.max_weight, aiFinding, policy);

        parameterResults.push({
          parameterId: param.id,
          maxWeight: param.max_weight,
          awardedPoints: awarded.points,
          result: aiFinding.result,
          auditSource: param.audit_source,
          reason: aiFinding.reason,
          failureReasonCode: aiFinding.failureReasonCodes[0] || undefined,
          evidenceUtteranceIds: aiFinding.evidenceUtteranceIds,
          requiresHumanReview: aiFinding.requiresHumanReview || awarded.requiresHumanReview,
        });
      } else {
        // Evidence source is unavailable (e.g. AUDIO, CRM, or unsupported HYBRID)
        parameterResults.push({
          parameterId: param.id,
          maxWeight: param.max_weight,
          awardedPoints: 0,
          result: "REVIEW_REQUIRED",
          auditSource: param.audit_source,
          reason: `Required audit source [${param.audit_source}] is not yet available in current evaluation context.`,
          requiresHumanReview: true,
        });
      }
    }

    // Deterministic calculation using core calculator
    const scoringResult = calculateScorecardResult(
      parameterResults,
      scorecard.passing_score,
      100.0
    );

    return { scoringResult, parameterResults };
  }

  /**
   * Deterministically calculates points from policy configuration without LLM intervention.
   */
  private static computeAwardedPoints(
    maxWeight: number,
    finding: NormalizedParameterFinding,
    policy: ParameterScoringPolicy
  ): { points: number; requiresHumanReview: boolean } {
    switch (policy.mode) {
      case "BINARY": {
        if (finding.result === "PASS") {
          return { points: maxWeight, requiresHumanReview: false };
        } else if (finding.result === "FAIL") {
          return { points: 0, requiresHumanReview: false };
        } else if (finding.result === "PARTIAL") {
          // Without explicit partial scoring policy, hold for review
          return { points: 0, requiresHumanReview: true };
        }
        return { points: 0, requiresHumanReview: true };
      }

      case "RUBRIC": {
        const levels = (policy.config.levels as Record<string, number>) || {};
        const pts = levels[finding.result];
        if (typeof pts === "number") {
          return { points: Math.max(0, Math.min(pts, maxWeight)), requiresHumanReview: false };
        }
        return { points: 0, requiresHumanReview: true };
      }

      case "MANUAL":
      default:
        return { points: 0, requiresHumanReview: true };
    }
  }

  static setPolicy(policy: ParameterScoringPolicy): void {
    scoringPoliciesRegistry.set(policy.parameterId, policy);
  }
}
