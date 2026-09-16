import crypto from "crypto";
import {
  AuditContext,
  AuditParameterTarget,
  AuditTranscriptLine,
  EphemeralEvidenceMapping,
} from "@/lib/providers/audit/types";
import {
  CallRecord,
  ScorecardWithDetails,
  AuditSource,
} from "@/types/scorecard";
import { NormalizedUtterance } from "@/lib/providers/transcription/types";

export class AuditContextBuilder {
  /**
   * Builds an immutable, PII-minimized, prompt-injection defended AuditContext.
   * Specification Sections 6, 7, 8, 16, 17, 18, 19, 20, 21
   */
  static buildAuditContext(
    call: CallRecord,
    transcriptId: string,
    transcriptVersion: number,
    utterances: NormalizedUtterance[],
    scorecard: ScorecardWithDetails,
    availableSources: AuditSource[] = ["TRANSCRIPT"],
    promptVersion: string = "qa-audit-v1"
  ): AuditContext {
    // 1. Source eligibility: Filter parameters to ONLY those that can be evaluated with available sources
    const targetParameters: AuditParameterTarget[] = [];

    for (const param of scorecard.parameters) {
      // Check if parameter itself has an available source (Section 15, Phase 1.1 Requirement 4)
      const isParamSourceAvailable = availableSources.includes(param.audit_source);

      if (isParamSourceAvailable) {
        // Map approved verbiage for this parameter
        const verbiage = scorecard.verbiage_guidelines
          .filter((v) => {
            const pName = param.parameter_name.toLowerCase();
            const vContext = v.parameter.toLowerCase();
            return pName.includes(vContext) || (vContext === "opening" && pName.includes("greeting"));
          })
          .map((v) => ({
            context: v.parameter,
            suggestedText: v.suggested_verbiage,
            requirementType: (v.parameter === "Security Checks" ? "EXACT" : "SEMANTIC") as "EXACT" | "SEMANTIC" | "SUGGESTED",
          }));

        targetParameters.push({
          parameterId: param.id,
          parameterName: param.parameter_name,
          sectionName: param.section_name,
          maxWeight: param.max_weight,
          description: param.description,
          auditSource: param.audit_source,
          rules: (param.rules || []).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            ruleType: r.rule_type,
            auditSource: r.audit_source,
          })),
          failureReasons: (param.failure_reasons || []).map((f) => ({
            code: f.code,
            label: f.label,
            description: f.description,
          })),
          approvedVerbiage: verbiage,
        });
      }
    }

    // 2. Format transcript lines and generate stable evidence IDs (U0001, U0002, ...)
    const transcriptLines: AuditTranscriptLine[] = [];
    const evidenceIdMap: Record<string, EphemeralEvidenceMapping> = {};

    utterances.forEach((u, index) => {
      const promptId = `U${String(index + 1).padStart(4, "0")}`;
      const timestampText = `${this.formatMs(u.startMs)} - ${this.formatMs(u.endMs)}`;

      // Apply PII Minimization (Section 20)
      const sanitizedText = this.minimizePII(u.text);

      transcriptLines.push({
        promptId,
        speakerRole: (u.speakerRole as "AGENT" | "CUSTOMER" | "UNKNOWN") || "UNKNOWN",
        speakerLabel: u.speakerLabel,
        timestampText,
        text: sanitizedText,
      });

      // Save real mapping
      evidenceIdMap[promptId] = {
        promptId,
        utteranceId: u.id || `utt-${index + 1}`,
        startMs: u.startMs,
        endMs: u.endMs,
        speakerRole: u.speakerRole || "UNKNOWN",
        text: u.text,
      };
    });

    // 3. Generate deterministic SHA-256 input hash (Section 15)
    const canonicalInput = JSON.stringify({
      callId: call.id,
      scorecardId: scorecard.id,
      scorecardVersion: scorecard.version,
      transcriptId,
      transcriptVersion,
      promptVersion,
      targetParamIds: targetParameters.map((p) => p.parameterId).sort(),
      transcriptHash: crypto
        .createHash("sha256")
        .update(transcriptLines.map((l) => `${l.promptId}:${l.text}`).join("\n"))
        .digest("hex"),
    });

    const inputHash = crypto.createHash("sha256").update(canonicalInput).digest("hex");

    return {
      callId: call.id,
      organizationId: call.organization_id,
      scorecardId: scorecard.id,
      scorecardName: scorecard.name,
      scorecardVersion: scorecard.version,
      transcriptId,
      transcriptVersion,
      availableSources,
      targetParameters,
      transcriptLines,
      evidenceIdMap,
      inputHash,
      promptVersion,
    };
  }

  /**
   * Redacts sensitive customer PII before sending to external model (Section 20).
   * Preserves customer name placeholder for greeting evaluation.
   */
  static minimizePII(text: string): string {
    let sanitized = text;

    // Phone numbers (e.g. 07020209088, +2348012345678, 08033344455)
    sanitized = sanitized.replace(
      /(?:\+?234|0)[789][01]\d{8}/g,
      (match) => `[CUSTOMER_PHONE_LAST4_${match.slice(-4)}]`
    );

    // General 10-11 digit sequences
    sanitized = sanitized.replace(
      /\b\d{10,11}\b/g,
      (match) => `[PHONE_NUMBER_LAST4_${match.slice(-4)}]`
    );

    // Email addresses
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[CUSTOMER_EMAIL]"
    );

    // Credit card / 16-digit PAN
    sanitized = sanitized.replace(
      /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
      "[REDACTED_CARD_NUMBER]"
    );

    return sanitized;
  }

  private static formatMs(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const millis = ms % 1000;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
}
