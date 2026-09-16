import { AuditContext, NormalizedAuditResult, NormalizedParameterFinding } from "@/lib/providers/audit/types";

export interface SemanticValidationOutcome {
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  validatedFindings?: NormalizedParameterFinding[];
}

export class AuditSemanticValidator {
  /**
   * Validates Layer 2 Semantic Constraints on AI QA audit responses.
   * Specification Sections 18, 26, 27, 49, 50, 63, 64, 65, 66
   */
  static validateAuditResult(
    context: AuditContext,
    result: NormalizedAuditResult
  ): SemanticValidationOutcome {
    const expectedParamIds = new Set(context.targetParameters.map((p) => p.parameterId));
    const seenParamIds = new Set<string>();

    // 1. Check parameter count and duplicates
    for (const finding of result.parameters) {
      if (!expectedParamIds.has(finding.parameterId)) {
        return {
          isValid: false,
          errorCode: "UNEXPECTED_PARAMETER",
          errorMessage: `Model evaluated unexpected parameter [${finding.parameterId}] not present in eligible target parameters.`,
        };
      }

      if (seenParamIds.has(finding.parameterId)) {
        return {
          isValid: false,
          errorCode: "DUPLICATE_PARAMETER",
          errorMessage: `Model returned duplicate evaluation for parameter [${finding.parameterId}].`,
        };
      }
      seenParamIds.add(finding.parameterId);

      // Find parameter definition
      const targetParam = context.targetParameters.find((p) => p.parameterId === finding.parameterId)!;

      // 2. Validate confidence bounds
      if (typeof finding.confidence !== "number" || finding.confidence < 0 || finding.confidence > 1) {
        return {
          isValid: false,
          errorCode: "INVALID_CONFIDENCE",
          errorMessage: `Parameter [${targetParam.parameterName}] returned invalid confidence [${finding.confidence}]. Expected 0.0 - 1.0.`,
        };
      }

      // 3. Validate Evidence IDs (Section 18, 63)
      for (const evidenceId of finding.evidenceUtteranceIds) {
        if (!context.evidenceIdMap[evidenceId]) {
          return {
            isValid: false,
            errorCode: "INVALID_EVIDENCE_ID",
            errorMessage: `Model returned hallucinated evidence ID [${evidenceId}] that does not exist in the active transcript.`,
          };
        }
      }

      // 4. FAIL and PARTIAL must contain supporting evidence
      if ((finding.result === "FAIL" || finding.result === "PARTIAL") && finding.evidenceUtteranceIds.length === 0) {
        return {
          isValid: false,
          errorCode: "MISSING_EVIDENCE_FOR_FAILURE",
          errorMessage: `Parameter [${targetParam.parameterName}] resulted in '${finding.result}' but cited 0 supporting evidence utterances.`,
        };
      }

      // 5. Validate Failure Reason Codes (Section 49, 64)
      if (finding.failureReasonCodes && finding.failureReasonCodes.length > 0) {
        const validCodes = new Set(targetParam.failureReasons.map((f) => f.code));
        for (const code of finding.failureReasonCodes) {
          if (!validCodes.has(code)) {
            return {
              isValid: false,
              errorCode: "INVALID_FAILURE_REASON",
              errorMessage: `Failure reason code '${code}' is not valid for parameter '${targetParam.parameterName}'. Available codes: ${Array.from(validCodes).join(", ")}.`,
            };
          }
        }
      }
    }

    // 6. Check for missing required parameters (Section 66)
    if (seenParamIds.size < expectedParamIds.size) {
      const missing = Array.from(expectedParamIds).filter((id) => !seenParamIds.has(id));
      return {
        isValid: false,
        errorCode: "MISSING_PARAMETER",
        errorMessage: `Model omitted ${missing.length} eligible parameters: ${missing.join(", ")}.`,
      };
    }

    return {
      isValid: true,
      validatedFindings: result.parameters,
    };
  }
}
