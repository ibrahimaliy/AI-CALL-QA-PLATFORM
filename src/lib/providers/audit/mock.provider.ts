import {
  AIAuditProvider,
  AuditContext,
  NormalizedAuditResult,
  NormalizedParameterFinding,
} from "./types";

export class MockAIAuditProvider implements AIAuditProvider {
  readonly name = "MOCK_AUDIT_PROVIDER";

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async evaluateAudit(context: AuditContext): Promise<NormalizedAuditResult> {
    const findings: NormalizedParameterFinding[] = [];

    for (const param of context.targetParameters) {
      if (param.parameterName.toLowerCase().includes("greeting")) {
        // Find opening utterance
        const opening = context.transcriptLines.find(
          (l) => l.speakerRole === "AGENT" && l.promptId === "U0001"
        );
        const hasOpening = opening && opening.text.toLowerCase().includes("thank you for calling");

        if (hasOpening) {
          findings.push({
            parameterId: param.parameterId,
            result: "PASS",
            confidence: 0.98,
            failureReasonCodes: [],
            reason: "Agent adhered to standard opening greeting verbiage including brand name, agent name, and welcoming phrase.",
            evidenceUtteranceIds: [opening.promptId],
            requiresHumanReview: false,
          });
        } else {
          findings.push({
            parameterId: param.parameterId,
            result: "FAIL",
            confidence: 0.92,
            failureReasonCodes: ["GREETING_NOT_ADHERED"],
            reason: "Agent failed to adhere to the required greeting verbiage.",
            evidenceUtteranceIds: opening ? [opening.promptId] : ["U0001"],
            requiresHumanReview: false,
          });
        }
      } else if (param.parameterName.toLowerCase().includes("probing")) {
        // Check for probing
        const agentLines = context.transcriptLines.filter((l) => l.speakerRole === "AGENT");
        const hasProbing = agentLines.some((l) =>
          l.text.toLowerCase().includes("what lights") ||
          l.text.toLowerCase().includes("when did it start")
        );

        if (hasProbing) {
          findings.push({
            parameterId: param.parameterId,
            result: "PASS",
            confidence: 0.94,
            failureReasonCodes: [],
            reason: "Agent probed the root cause effectively.",
            evidenceUtteranceIds: ["U0002", "U0003"],
            requiresHumanReview: false,
          });
        } else {
          const failureCode = param.failureReasons.find((f) => f.code === "DID_NOT_PROBE")?.code ||
            param.failureReasons[0]?.code || "DID_NOT_PROBE";

          findings.push({
            parameterId: param.parameterId,
            result: "FAIL",
            confidence: 0.94,
            failureReasonCodes: [failureCode],
            reason: "The agent proceeded to account lookup without asking questions to probe the nature of the internet problem.",
            evidenceUtteranceIds: ["U0002", "U0003"],
            requiresHumanReview: false,
          });
        }
      } else if (param.parameterName.toLowerCase().includes("completeness")) {
        findings.push({
          parameterId: param.parameterId,
          result: "PASS",
          confidence: 0.95,
          failureReasonCodes: [],
          reason: "Agent addressed the inquiry and confirmed customer details before investigating.",
          evidenceUtteranceIds: ["U0004", "U0005"],
          requiresHumanReview: false,
        });
      } else {
        // Fallback for any other transcript parameter
        findings.push({
          parameterId: param.parameterId,
          result: "PASS",
          confidence: 0.90,
          failureReasonCodes: [],
          reason: `Transcript evidence satisfies standard criteria for ${param.parameterName}.`,
          evidenceUtteranceIds: ["U0001"],
          requiresHumanReview: false,
        });
      }
    }

    return {
      provider: this.name,
      model: "mock-qa-evaluator",
      promptVersion: context.promptVersion,
      summary: "Agent adhered to the standard greeting and verification protocol but skipped probing the technical symptoms of the connectivity issue before placing customer on hold.",
      parameters: findings,
      strengths: [
        "Warm, compliant opening greeting adhering to brand guidelines",
        "Clear identity and account verification procedure followed",
      ],
      improvementAreas: [
        "Probe technical problem indicators before proceeding directly to router reset",
      ],
      requestTokenCount: 1240,
      responseTokenCount: 395,
      responseId: `mock_resp_${Date.now()}`,
    };
  }
}
