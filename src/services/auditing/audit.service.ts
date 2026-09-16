import {
  AIAuditProvider,
  AuditContext,
  NormalizedAuditResult,
} from "@/lib/providers/audit/types";
import { OpenAIAuditProvider } from "@/lib/providers/audit/openai.provider";
import { MockAIAuditProvider } from "@/lib/providers/audit/mock.provider";
import { AuditContextBuilder } from "./audit-context-builder";
import { AuditSemanticValidator } from "./audit-validator";
import { ScoringPolicyEngine } from "../scoring/policy-engine";
import { CallService } from "../calls/call.service";
import { TranscriptionService } from "../transcription/transcription.service";
import { AuthorizationService, UserAuthContext } from "../auth/authorization";
import { assertValidStatusTransition } from "../calls/state-machine";
import { INITIAL_SCORECARD } from "@/lib/seed-data";
import {
  AuditResultType,
  AuditSource,
  ParameterScoringInput,
  ScoringResult,
} from "@/types/scorecard";
import { AIRecommendation } from "@/types/review";
import { features } from "@/lib/config/features";

// In-memory data store for local execution & testing
export interface StoredAuditRun {
  id: string;
  audit_id?: string;
  call_id: string;
  scorecard_id: string;
  scorecard_version: string;
  transcript_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";
  started_at: string;
  completed_at?: string;
  failed_at?: string;
  request_token_count?: number;
  response_token_count?: number;
  response_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
}

export interface StoredAuditParameterResult {
  id: string;
  audit_id: string;
  parameter_id: string;
  parameter_name: string;
  section_name: string;
  max_weight: number;
  awarded_points: number;
  result: AuditResultType;
  audit_source: AuditSource;
  confidence?: number;
  reason?: string;
  failure_reason_code?: string;
  requires_human_review: boolean;
  evidence: Array<{
    id: string;
    utterance_id: string;
    prompt_id: string;
    start_ms: number;
    end_ms: number;
    speaker_role: string;
    quote_text: string;
  }>;
}

export interface StoredAudit {
  id: string;
  call_id: string;
  scorecard_id: string;
  scorecard_version: string;
  ai_provider: string;
  ai_model: string;
  prompt_version: string;
  auditable_weight: number;
  ai_awarded_points: number;
  ai_normalized_percentage: number;
  ai_coverage?: number;
  ai_recommendation?: AIRecommendation;
  final_score: number | null;
  passing_score: number;
  is_passed: boolean;
  un_audited_weight: number;
  status: "COMPLETED" | "REVIEW_REQUIRED";
  summary: string;
  strengths: string[];
  improvement_areas: string[];
  created_at: string;
  parameters: StoredAuditParameterResult[];
}
import { getGlobalStores } from "@/lib/store/global-store";

// Central global stores singleton
const globalStores = getGlobalStores();
const auditRunsStore = globalStores.auditRuns;
const auditsStore = globalStores.audits;

function getAIAuditProvider(): AIAuditProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== "your-openai-api-key" && apiKey.length > 10) {
    return new OpenAIAuditProvider(apiKey);
  }
  return new MockAIAuditProvider();
}

export class AuditService {
  /**
   * Orchestrates the AI QA evaluation on an active validated call transcript.
   * Specification Sections 13, 14, 15, 26, 27, 33, 34, 35, 36, 37, 56, 57, 58, 59, 60
   */
  static async executeCallAudit(
    callId: string,
    userContext: UserAuthContext,
    options?: { forceMock?: boolean; forceNewRun?: boolean }
  ): Promise<{ audit: StoredAudit; run: StoredAuditRun; isCached: boolean }> {
    if (!features.aiQa) {
      throw new Error("AI QA auditing is currently disabled pending approved QA rules.");
    }
    // 1. Check Authorization (Section 60)
    AuthorizationService.assertOrgAccess(userContext, userContext.organizationId);
    const allowedRoles = ["ADMIN", "QA_MANAGER", "QA_AUDITOR"];
    if (!allowedRoles.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' is not authorized to start an AI QA audit.`);
    }

    // 2. Fetch and validate call record
    const call = (await CallService.getCallRecord(callId)) || CallService.getRawCall(callId);
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // 3. Verify transcript readiness and integrity (Section 25)
    if (call.processing_status !== "TRANSCRIBED" && call.processing_status !== "REVIEW_REQUIRED" && call.processing_status !== "COMPLETED") {
      throw new Error(`Cannot audit call: Call processing status is '${call.processing_status}'. Expected 'TRANSCRIBED'.`);
    }

    const transcriptData = await TranscriptionService.getCallTranscript(callId);
    if (!transcriptData.transcript) {
      throw new Error("Cannot audit call: No active transcript found. Complete transcription first.");
    }

    const activeTr = transcriptData.transcript;
    const isMock =
      activeTr.provider === "MOCK_PROVIDER" ||
      activeTr.provider === "mock" ||
      (activeTr.full_text &&
        activeTr.full_text.includes("Boluwatife") &&
        activeTr.full_text.includes("Andrea Ayinde"));

    if (isMock && process.env.TRANSCRIPTION_PROVIDER !== "mock" && !options?.forceMock) {
      throw new Error(
        "Cannot audit call: Active transcript is mock or fixture data. Real provider transcription is required before AI evaluation."
      );
    }

    if (activeTr.requires_speaker_review) {
      throw new Error("Cannot audit call: Low-confidence speaker mapping requires supervisor confirmation before AI evaluation.");
    }
    if (activeTr.requires_transcript_review) {
      throw new Error("Cannot audit call: Transcript is flagged as low confidence or requires human review.");
    }

    // 4. Build AI Audit Context & Compute Input Hash (Sections 15, 16, 20)
    const scorecard = INITIAL_SCORECARD;
    const promptVersion = process.env.OPENAI_QA_PROMPT_VERSION || "qa-audit-v1";
    const context = AuditContextBuilder.buildAuditContext(
      call,
      transcriptData.transcript.id,
      transcriptData.transcript.version,
      transcriptData.utterances,
      scorecard,
      ["TRANSCRIPT"],
      promptVersion
    );

    // 5. Idempotency & Caching Check (Section 15, 57, 69)
    if (!options?.forceNewRun) {
      for (const r of auditRunsStore.values()) {
        if (r.call_id === callId && r.input_hash === context.inputHash && r.status === "COMPLETED" && r.audit_id) {
          const cachedAudit = auditsStore.get(r.audit_id);
          if (cachedAudit) {
            return { audit: cachedAudit, run: r, isCached: true };
          }
        }
      }
    }

    // 6. Concurrency Protection (Section 58)
    for (const r of auditRunsStore.values()) {
      if (r.call_id === callId && (r.status === "PROCESSING" || r.status === "PENDING")) {
        throw new Error("An AI QA audit is already running for this call interaction.");
      }
    }

    // 7. Initialize Pre-flight Audit Run record (Section 13)
    const provider = options?.forceMock ? new MockAIAuditProvider() : getAIAuditProvider();
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();
    const run: StoredAuditRun = {
      id: runId,
      call_id: callId,
      scorecard_id: scorecard.id,
      scorecard_version: scorecard.version,
      transcript_id: transcriptData.transcript.id,
      provider: provider.name,
      model: process.env.OPENAI_QA_MODEL || "gpt-5.6-terra",
      prompt_version: promptVersion,
      input_hash: context.inputHash,
      status: "PROCESSING",
      started_at: now,
      created_at: now,
    };
    auditRunsStore.set(runId, run);

    // 8. Update Call State: -> AUDITING (Section 34)
    call.processing_status = "AUDITING";
    call.updated_at = now;
    CallService.updateCall(call);

    CallService.addProcessingEvent(callId, {
      stage: "AUDIT",
      status: "STARTED",
      message: `AI QA audit started using ${provider.name} (Prompt: ${promptVersion}).`,
      metadata: { runId, inputHash: context.inputHash },
      created_at: now,
    });

    try {
      // 9. Execute External Provider Evaluation
      const rawAuditResult: NormalizedAuditResult = await provider.evaluateAudit(context);

      // 10. Layer 2 Semantic Validation (Section 26, 27)
      const semanticValidation = AuditSemanticValidator.validateAuditResult(context, rawAuditResult);
      if (!semanticValidation.isValid) {
        run.status = "REJECTED";
        run.failed_at = new Date().toISOString();
        run.error_code = semanticValidation.errorCode;
        run.error_message = semanticValidation.errorMessage;
        auditRunsStore.set(runId, run);

        // Reset call status for safe retry
        call.processing_status = "TRANSCRIBED";
        call.processing_error = semanticValidation.errorMessage;
        call.updated_at = new Date().toISOString();
        CallService.updateCall(call);

        CallService.addProcessingEvent(callId, {
          stage: "AUDIT",
          status: "FAILED",
          message: `Model output rejected by semantic validation: ${semanticValidation.errorMessage}`,
          created_at: new Date().toISOString(),
        });

        throw new Error(`Semantic Validation Failed: ${semanticValidation.errorMessage}`);
      }

      // 11. Deterministic Backend Scoring Policy Engine (Section 28, 29, 31, 32)
      const evaluated = ScoringPolicyEngine.evaluateScorecard(
        scorecard,
        semanticValidation.validatedFindings!,
        ["TRANSCRIPT"]
      );

      // 12. Build Stored Audit Record & Link Evidences (Section 38, 48)
      const auditId = crypto.randomUUID();
      const completedAt = new Date().toISOString();

      const storedParameters: StoredAuditParameterResult[] = [];
      for (const pResult of evaluated.parameterResults) {
        const paramDef = scorecard.parameters.find((p) => p.id === pResult.parameterId)!;
        const finding = semanticValidation.validatedFindings?.find((f) => f.parameterId === pResult.parameterId);

        // Resolve evidence citations to real utterances
        const evidenceLinks: StoredAuditParameterResult["evidence"] = [];
        if (pResult.evidenceUtteranceIds) {
          for (const promptId of pResult.evidenceUtteranceIds) {
            const mapped = context.evidenceIdMap[promptId];
            if (mapped) {
              evidenceLinks.push({
                id: crypto.randomUUID(),
                utterance_id: mapped.utteranceId,
                prompt_id: promptId,
                start_ms: mapped.startMs,
                end_ms: mapped.endMs,
                speaker_role: mapped.speakerRole,
                quote_text: mapped.text,
              });
            }
          }
        }

        storedParameters.push({
          id: crypto.randomUUID(),
          audit_id: auditId,
          parameter_id: pResult.parameterId,
          parameter_name: paramDef.parameter_name,
          section_name: paramDef.section_name,
          max_weight: pResult.maxWeight,
          awarded_points: pResult.awardedPoints,
          result: pResult.result,
          audit_source: pResult.auditSource,
          confidence: finding?.confidence,
          reason: pResult.reason,
          failure_reason_code: pResult.failureReasonCode,
          requires_human_review: pResult.requiresHumanReview,
          evidence: evidenceLinks,
        });
      }

      const hasFailure = storedParameters.some((p) => p.result === "FAIL" || p.result === "PARTIAL");
      const hasAmbiguity = storedParameters.some(
        (p) => p.audit_source === "TRANSCRIPT" && p.confidence !== undefined && p.confidence < 0.8
      );
      let aiRecommendation: AIRecommendation = "HIGH_CONFIDENCE_PASS";
      if (hasFailure) {
        aiRecommendation = "REVIEW_FAILURE"; // Safety rule: Section 13 & 23
      } else if (hasAmbiguity) {
        aiRecommendation = "REVIEW_AMBIGUOUS";
      } else if (evaluated.scoringResult.auditableWeight < 30) {
        aiRecommendation = "INSUFFICIENT_EVIDENCE";
      }

      const storedAudit: StoredAudit = {
        id: auditId,
        call_id: callId,
        scorecard_id: scorecard.id,
        scorecard_version: scorecard.version,
        ai_provider: rawAuditResult.provider,
        ai_model: rawAuditResult.model,
        prompt_version: promptVersion,
        auditable_weight: evaluated.scoringResult.auditableWeight,
        ai_awarded_points: evaluated.scoringResult.auditedScore,
        ai_normalized_percentage: evaluated.scoringResult.provisionalPercentage,
        ai_coverage: Number(((evaluated.scoringResult.auditableWeight / 100.0) * 100).toFixed(2)),
        ai_recommendation: aiRecommendation,
        final_score: evaluated.scoringResult.finalScore,
        passing_score: evaluated.scoringResult.passingScore,
        is_passed: evaluated.scoringResult.isPassed,
        un_audited_weight: evaluated.scoringResult.unAuditedWeight,
        status: evaluated.scoringResult.requiresHumanReview ? "REVIEW_REQUIRED" : "COMPLETED",
        summary: rawAuditResult.summary,
        strengths: rawAuditResult.strengths,
        improvement_areas: rawAuditResult.improvementAreas,
        created_at: completedAt,
        parameters: storedParameters,
      };

      auditsStore.set(auditId, storedAudit);

      // 13. Update Audit Run
      run.audit_id = auditId;
      run.status = "COMPLETED";
      run.completed_at = completedAt;
      run.request_token_count = rawAuditResult.requestTokenCount;
      run.response_token_count = rawAuditResult.responseTokenCount;
      run.response_id = rawAuditResult.responseId;
      auditRunsStore.set(runId, run);

      // 14. Update Call Status: AUDITING -> REVIEW_REQUIRED (Section 34)
      // Because 70 points remain pending audio/CRM/knowledge evidence, call ends in REVIEW_REQUIRED
      call.processing_status = "REVIEW_REQUIRED";
      call.updated_at = completedAt;
      CallService.updateCall(call);

      CallService.addProcessingEvent(callId, {
        stage: "AUDIT",
        status: "COMPLETED",
        message: `AI QA audit completed. ${evaluated.scoringResult.summaryText}`,
        metadata: {
          auditId,
          auditedScore: evaluated.scoringResult.auditedScore,
          auditableWeight: evaluated.scoringResult.auditableWeight,
          provisionalPercentage: evaluated.scoringResult.provisionalPercentage,
        },
        created_at: completedAt,
      });

      return { audit: storedAudit, run, isCached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI QA audit failed.";
      run.status = "FAILED";
      run.failed_at = new Date().toISOString();
      run.error_message = msg;
      auditRunsStore.set(runId, run);

      call.processing_status = "TRANSCRIBED"; // Allow retry
      call.processing_error = msg;
      call.updated_at = new Date().toISOString();
      CallService.updateCall(call);

      CallService.addProcessingEvent(callId, {
        stage: "AUDIT",
        status: "FAILED",
        message: `AI QA audit execution failed: ${msg}`,
        created_at: new Date().toISOString(),
      });

      throw err;
    }
  }

  /**
   * Retrieves active audit result and run history for a call.
   */
  static async getCallAudit(
    callId: string,
    userContext: UserAuthContext
  ): Promise<{
    audit: StoredAudit | null;
    runs: StoredAuditRun[];
  }> {
    const call = (await CallService.getCallRecord(callId)) || CallService.getRawCall(callId);
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // Find runs for this call
    const runs = Array.from(auditRunsStore.values())
      .filter((r) => r.call_id === callId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Find latest completed audit
    const latestRun = runs.find((r) => r.status === "COMPLETED" && r.audit_id);
    const audit = latestRun?.audit_id ? auditsStore.get(latestRun.audit_id) || null : null;

    return { audit, runs };
  }

  static getRunById(runId: string): StoredAuditRun | undefined {
    return auditRunsStore.get(runId);
  }

  static async getStoredAuditById(auditId: string): Promise<StoredAudit | undefined> {
    return auditsStore.get(auditId);
  }

  static setStoredAudit(audit: StoredAudit): void {
    auditsStore.set(audit.id, audit);
  }
}
