import crypto from "crypto";
import {
  StoredAuditReview,
  StoredAuditResultOverride,
  ParameterDecisionInput,
  ReviewPriority,
  QAGoldLabel,
  CalibrationDataset,
  CalibrationDatasetItem,
  DatasetSourceType,
} from "@/types/review";
import { UserAuthContext, AuthorizationService } from "../auth/authorization";
import { CallService } from "../calls/call.service";
import { AuditService } from "../auditing/audit.service";
import { TranscriptionService } from "../transcription/transcription.service";
import { INITIAL_SCORECARD } from "@/lib/seed-data";
import { ScoringPolicyEngine } from "../scoring/policy-engine";
import {
  GOLD_BENCHMARK_DATASET,
  SYNTHETIC_TELECOM_BENCHMARK_V1,
} from "@/lib/dataset/gold-calls-dataset";

import { getGlobalStores } from "@/lib/store/global-store";

// Central global stores singleton
const globalStores = getGlobalStores();
const reviewsStore = globalStores.reviews;
const auditToReviewIndex = globalStores.auditToReviewIndex;
const goldLabelsStore = globalStores.goldLabels;
const calibrationDatasetsStore = globalStores.calibrationDatasets;
const calibrationDatasetItemsStore = globalStores.calibrationDatasetItems;

export class ReviewService {
  /**
   * Retrieves or initializes a human review for a given audit.
   * Specification Sections 8, 9, 10, 14, 15, 19, 20, 21, 22
   */
  static async getOrCreateReview(
    auditId: string,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const existingReviewId = auditToReviewIndex.get(auditId);
    if (existingReviewId) {
      const existing = reviewsStore.get(existingReviewId);
      if (existing) {
        AuthorizationService.assertOrgAccess(userContext, existing.organization_id);
        return existing;
      }
    }

    // Fetch parent audit
    const auditData = await AuditService.getStoredAuditById(auditId);
    if (!auditData) {
      throw new Error(`Audit [${auditId}] not found.`);
    }

    const call = CallService.getRawCall(auditData.call_id);
    if (!call) {
      throw new Error(`Call [${auditData.call_id}] not found.`);
    }
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    const scorecard = INITIAL_SCORECARD;
    const reviewId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Build decisions for all 10 scorecard parameters
    const decisions: StoredAuditResultOverride[] = [];

    for (const param of scorecard.parameters) {
      const aiParam = auditData.parameters.find((p) => p.parameter_id === param.id);
      const isAIEvaluated = aiParam && aiParam.audit_source === "TRANSCRIPT";

      let evalSource: StoredAuditResultOverride["evaluation_source"] = "AI_TRANSCRIPT";
      if (param.audit_source === "AUDIO") evalSource = "HUMAN_AUDIO";
      else if (param.audit_source === "CRM") evalSource = "HUMAN_CRM";
      else if (param.audit_source === "HYBRID") evalSource = "HUMAN_HYBRID";

      decisions.push({
        id: crypto.randomUUID(),
        review_id: reviewId,
        parameter_id: param.id,
        parameter_name: param.parameter_name,
        section_name: param.section_name,
        max_weight: param.max_weight,
        review_action: isAIEvaluated ? "AGREED" : "OVERRIDDEN",
        ai_result: isAIEvaluated ? aiParam.result : undefined,
        human_result: isAIEvaluated ? aiParam.result : "REVIEW_REQUIRED",
        ai_awarded_points: isAIEvaluated ? aiParam.awarded_points : 0,
        human_awarded_points: isAIEvaluated ? aiParam.awarded_points : 0,
        ai_failure_reason: isAIEvaluated ? aiParam.failure_reason_code : undefined,
        human_failure_reason: isAIEvaluated ? aiParam.failure_reason_code : undefined,
        override_reason_category: undefined,
        override_notes: undefined,
        ai_evidence_accuracy: isAIEvaluated ? "CORRECT" : undefined,
        human_evidence_utterance_ids: [],
        evaluation_source: evalSource,
        crm_checked: param.audit_source === "CRM" ? false : undefined,
        jira_checked: param.audit_source === "CRM" ? false : undefined,
        created_at: now,
        updated_at: now,
      });
    }

    const review: StoredAuditReview = {
      id: reviewId,
      audit_id: auditId,
      call_id: auditData.call_id,
      organization_id: call.organization_id,
      version: 1,
      priority: "NORMAL",
      status: "UNASSIGNED",
      original_ai_score: auditData.ai_awarded_points,
      reviewed_score: auditData.ai_awarded_points,
      final_score: null,
      is_passed: false,
      created_at: now,
      updated_at: now,
      decisions,
    };

    reviewsStore.set(reviewId, review);
    auditToReviewIndex.set(auditId, reviewId);
    return review;
  }

  /**
   * Assigns an audit review to an authorized reviewer.
   * Specification Section 11, 12
   */
  static async assignReview(
    reviewId: string,
    reviewerId: string,
    priority: ReviewPriority,
    userContext: UserAuthContext,
    dueAt?: string
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    const allowedRoles = ["ADMIN", "QA_MANAGER", "QA_AUDITOR"];
    if (!allowedRoles.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' cannot assign reviews.`);
    }

    const now = new Date().toISOString();
    review.reviewer_id = reviewerId;
    review.assigned_by = userContext.userId;
    review.assigned_at = now;
    review.priority = priority;
    if (dueAt) review.due_at = dueAt;
    if (review.status === "UNASSIGNED") review.status = "ASSIGNED";
    review.version += 1;
    review.updated_at = now;

    reviewsStore.set(reviewId, review);
    return review;
  }

  /**
   * Saves a draft of reviewer decisions with optimistic concurrency protection.
   * Specification Sections 15, 16, 17, 23, 24, 28, 29
   */
  static async saveDraftReview(
    reviewId: string,
    expectedVersion: number,
    decisionsInput: ParameterDecisionInput[],
    comment: string | undefined,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    // Concurrency check (Section 28)
    if (review.version !== expectedVersion) {
      throw new Error(
        `409 CONFLICT: Stale review version. Expected version ${expectedVersion}, but current version is ${review.version}. Please reload review workspace.`
      );
    }

    // Role check (Section 12)
    const allowed = ["ADMIN", "QA_MANAGER", "QA_AUDITOR"];
    if (!allowed.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' is not authorized to edit reviews.`);
    }

    const call = CallService.getRawCall(review.call_id);
    if (call && call.agent_id === userContext.userId) {
      throw new Error("Agents must not review their own audit (Section 12).");
    }

    const now = new Date().toISOString();
    const scorecard = INITIAL_SCORECARD;

    // Apply parameter decisions and validate scoring policy bounds (Section 24)
    for (const input of decisionsInput) {
      const existingDecision = review.decisions.find((d) => d.parameter_id === input.parameter_id);
      if (!existingDecision) continue;

      const paramDef = scorecard.parameters.find((p) => p.id === input.parameter_id);
      if (!paramDef) continue;

      // Scoring policy constraint (Section 24): Points cannot exceed max_weight and cannot be negative
      if (input.human_awarded_points < 0 || input.human_awarded_points > paramDef.max_weight) {
        throw new Error(
          `Invalid points for parameter '${paramDef.parameter_name}': ${input.human_awarded_points}. Must be between 0 and ${paramDef.max_weight}.`
        );
      }

      // If binary policy, points must be either 0 or max_weight
      if (input.human_result === "FAIL" && input.human_awarded_points !== 0) {
        input.human_awarded_points = 0;
      }

      // Override validation (Section 16): Require override category or explanation if action is OVERRIDDEN
      if (input.review_action === "OVERRIDDEN") {
        if (!input.override_reason_category && !input.override_notes) {
          throw new Error(
            `Override requires an explanation or override reason category for parameter '${paramDef.parameter_name}'.`
          );
        }
      }

      existingDecision.review_action = input.review_action;
      existingDecision.human_result = input.human_result;
      existingDecision.human_awarded_points = Number(input.human_awarded_points.toFixed(2));
      existingDecision.human_failure_reason = input.human_failure_reason || existingDecision.human_failure_reason;
      existingDecision.override_reason_category = input.override_reason_category;
      existingDecision.override_notes = input.override_notes;
      existingDecision.ai_evidence_accuracy = input.ai_evidence_accuracy;
      if (input.human_evidence_utterance_ids) {
        existingDecision.human_evidence_utterance_ids = input.human_evidence_utterance_ids;
      }
      if (input.evaluation_source) {
        existingDecision.evaluation_source = input.evaluation_source;
      }
      if (input.crm_checked !== undefined) existingDecision.crm_checked = input.crm_checked;
      if (input.jira_checked !== undefined) existingDecision.jira_checked = input.jira_checked;
      existingDecision.updated_at = now;
    }

    // Compute reviewed score sum
    const totalReviewedPoints = review.decisions.reduce((sum, d) => sum + d.human_awarded_points, 0);
    review.reviewed_score = Number(totalReviewedPoints.toFixed(2));
    if (comment !== undefined) review.comment = comment;

    if (review.status === "UNASSIGNED" || review.status === "ASSIGNED") {
      review.status = "IN_REVIEW";
    }
    review.version += 1;
    review.updated_at = now;

    reviewsStore.set(reviewId, review);
    return review;
  }

  /**
   * Submits review for supervisor approval or finalization.
   * Specification Sections 10, 27, 33
   */
  static async submitReview(
    reviewId: string,
    expectedVersion: number,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    if (review.version !== expectedVersion) {
      throw new Error(`409 CONFLICT: Stale review version. Expected ${expectedVersion}, got ${review.version}.`);
    }

    // Verify that all 10 scorecard parameters have been evaluated (Section 27)
    const pendingParams = review.decisions.filter(
      (d) => d.human_result === "REVIEW_REQUIRED" || !d.human_result
    );
    if (pendingParams.length > 0) {
      throw new Error(
        `Cannot submit review: ${pendingParams.length} parameter(s) remain in REVIEW_REQUIRED status. Complete all criteria first.`
      );
    }

    review.status = "SUBMITTED";
    review.version += 1;
    review.updated_at = new Date().toISOString();
    reviewsStore.set(reviewId, review);
    return review;
  }

  /**
   * Approves a submitted review.
   * Specification Section 10, 12, 33
   */
  static async approveReview(
    reviewId: string,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    const allowed = ["ADMIN", "QA_MANAGER", "SUPERVISOR"];
    if (!allowed.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' cannot approve reviews.`);
    }

    if (review.status !== "SUBMITTED" && review.status !== "IN_REVIEW") {
      throw new Error(`Cannot approve review in status '${review.status}'. Expected 'SUBMITTED'.`);
    }

    review.status = "APPROVED";
    review.version += 1;
    review.updated_at = new Date().toISOString();
    reviewsStore.set(reviewId, review);
    return review;
  }

  /**
   * Reopens a submitted or finalized review with required explanation.
   * Specification Section 10, 34
   */
  static async reopenReview(
    reviewId: string,
    reopenReason: string,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    const allowed = ["ADMIN", "QA_MANAGER"];
    if (!allowed.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' cannot reopen reviews.`);
    }

    if (!reopenReason || reopenReason.trim().length === 0) {
      throw new Error("Reopen reason is mandatory when reopening an audit review.");
    }

    review.status = "REOPENED";
    review.reopen_reason = reopenReason;
    review.version += 1;
    review.updated_at = new Date().toISOString();
    reviewsStore.set(reviewId, review);

    CallService.addProcessingEvent(review.call_id, {
      stage: "REVIEW",
      status: "REOPENED",
      message: `Audit review reopened by ${userContext.fullName}: ${reopenReason}`,
      created_at: new Date().toISOString(),
    });

    return review;
  }

  /**
   * Finalizes human review, calculates final deterministic score, and generates gold calibration labels.
   * Specification Sections 23, 24, 25, 26, 27, 38
   */
  static async finalizeReview(
    reviewId: string,
    userContext: UserAuthContext
  ): Promise<StoredAuditReview> {
    const review = reviewsStore.get(reviewId);
    if (!review) throw new Error(`Review [${reviewId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, review.organization_id);

    const allowed = ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR"];
    if (!allowed.includes(userContext.role)) {
      throw new Error(`Role '${userContext.role}' cannot finalize reviews.`);
    }

    // Check all 10 criteria resolved (Section 27)
    const unresolved = review.decisions.filter(
      (d) => d.human_result === "REVIEW_REQUIRED" || !d.human_result
    );
    if (unresolved.length > 0) {
      throw new Error(
        `Cannot finalize review: ${unresolved.length} parameters are still pending evaluation. All 10 parameters must be resolved.`
      );
    }

    const scorecard = INITIAL_SCORECARD;
    const finalScore = review.decisions.reduce((sum, d) => sum + d.human_awarded_points, 0);
    const passingScore = scorecard.passing_score; // Retrieve from scorecard (Section 25)
    const isPassed = finalScore >= passingScore;

    const now = new Date().toISOString();
    review.final_score = Number(finalScore.toFixed(2));
    review.reviewed_score = review.final_score;
    review.is_passed = isPassed;
    review.status = "FINALIZED";
    review.version += 1;
    review.updated_at = now;
    reviewsStore.set(reviewId, review);

    // Transition call to COMPLETED (Section 65)
    const call = CallService.getRawCall(review.call_id);
    if (call) {
      call.processing_status = "COMPLETED";
      call.updated_at = now;
      CallService.updateCall(call);

      CallService.addProcessingEvent(review.call_id, {
        stage: "REVIEW",
        status: "COMPLETED",
        message: `Audit finalized with score ${review.final_score}/100.0 (${isPassed ? "PASS" : "FAIL"}).`,
        metadata: {
          reviewId,
          finalScore: review.final_score,
          isPassed,
          reviewerId: userContext.userId,
        },
        created_at: now,
      });
    }

    // Generate Gold Labels for calibration dataset (Section 38, Section 5, 6)
    const auditData = await AuditService.getStoredAuditById(review.audit_id);
    const transcriptData = await TranscriptionService.getCallTranscript(review.call_id).catch(() => ({ transcript: null }));
    const transcriptId = transcriptData?.transcript?.id || "default";

    // Ad-hoc/runtime reviews belong to PRODUCTION_REVIEWED, not a frozen synthetic benchmark
    const prodDatasetId = "ds-prod-reviewed";
    for (const d of review.decisions) {
      const aiParam = auditData?.parameters.find((p) => p.parameter_id === d.parameter_id);
      const isAuditableByAI = d.ai_result !== undefined;

      const isAgreement = isAuditableByAI ? d.ai_result === d.human_result : false;
      const failureReasonAgreement =
        isAuditableByAI && d.ai_result === "FAIL" && d.human_result === "FAIL"
          ? d.ai_failure_reason === d.human_failure_reason
          : undefined;

      const goldLabel: QAGoldLabel = {
        id: crypto.randomUUID(),
        dataset_id: prodDatasetId,
        dataset_version: "1.0.0",
        call_id: review.call_id,
        review_id: reviewId,
        transcript_id: transcriptId,
        scorecard_id: scorecard.id,
        scorecard_version: scorecard.version,
        parameter_id: d.parameter_id,
        parameter_name: d.parameter_name,
        ai_result: d.ai_result,
        human_result: d.human_result,
        is_agreement: isAgreement,
        ai_failure_reason: d.ai_failure_reason,
        human_failure_reason: d.human_failure_reason,
        failure_reason_agreement: failureReasonAgreement,
        ai_confidence: aiParam?.confidence,
        ai_evidence_accuracy: d.ai_evidence_accuracy,
        evidence_relevance:
          d.ai_evidence_accuracy === "CORRECT"
            ? "RELEVANT"
            : d.ai_evidence_accuracy === "PARTIALLY_CORRECT"
            ? "PARTIALLY_RELEVANT"
            : "IRRELEVANT",
        evidence_sufficiency:
          d.ai_evidence_accuracy === "CORRECT"
            ? "SUFFICIENT"
            : d.ai_evidence_accuracy === "PARTIALLY_CORRECT"
            ? "PARTIALLY_SUFFICIENT"
            : "INSUFFICIENT",
        ai_evidence: aiParam?.evidence || [],
        human_evidence: d.human_evidence_utterance_ids,
        reviewer_id: userContext.userId,
        organization_id: review.organization_id,
        created_at: now,
      };

      const key = ReviewService.buildGoldLabelKey(goldLabel);
      goldLabelsStore.set(key, goldLabel);
    }

    return review;
  }

  /**
   * Deterministic logical identity for gold labels (Section 5)
   */
  static buildGoldLabelKey(l: {
    dataset_id?: string;
    call_id: string;
    transcript_id?: string;
    scorecard_version: string;
    parameter_id: string;
  }): string {
    return `${l.dataset_id || "global"}_${l.call_id}_${l.transcript_id || "default"}_${l.scorecard_version}_${l.parameter_id}`;
  }

  /**
   * Retrieves single review by ID.
   */
  static getReviewById(reviewId: string): StoredAuditReview | undefined {
    return reviewsStore.get(reviewId);
  }

  /**
   * Lists reviews with filter support for review queue.
   * Specification Sections 31, 32
   */
  static listReviews(
    filters: {
      status?: string;
      priority?: string;
      assignedToMe?: boolean;
      organizationId?: string;
    },
    userContext: UserAuthContext
  ): StoredAuditReview[] {
    const list: StoredAuditReview[] = [];

    for (const r of reviewsStore.values()) {
      if (r.organization_id !== userContext.organizationId) continue;
      if (filters.status && filters.status !== "ALL" && r.status !== filters.status) continue;
      if (filters.priority && filters.priority !== "ALL" && r.priority !== filters.priority) continue;
      if (filters.assignedToMe && r.reviewer_id !== userContext.userId) continue;
      list.push(r);
    }

    // Sort by updated_at descending
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Returns stored gold labels scoped to specific dataset or organization.
   * Specification Sections 4, 5, 6, 7
   */
  static getAllGoldLabels(
    filter?: { datasetId?: string; organizationId?: string; sourceType?: DatasetSourceType } | string
  ): QAGoldLabel[] {
    let labels = Array.from(goldLabelsStore.values());
    const options = typeof filter === "string" ? { organizationId: filter } : filter || {};

    if (options.organizationId) {
      labels = labels.filter((l) => l.organization_id === options.organizationId);
    }

    if (options.datasetId) {
      labels = labels.filter((l) => l.dataset_id === options.datasetId);
    } else if (options.sourceType) {
      const matchingDatasetIds = new Set(
        Array.from(calibrationDatasetsStore.values())
          .filter((d) => d.dataset_source_type === options.sourceType)
          .map((d) => d.id)
      );
      labels = labels.filter((l) => l.dataset_id && matchingDatasetIds.has(l.dataset_id));
    }

    return labels;
  }

  /**
   * Dataset management methods (Section 6)
   */
  static seedDataset(dataset: CalibrationDataset, items?: CalibrationDatasetItem[]): void {
    calibrationDatasetsStore.set(dataset.id, dataset);
    if (items) {
      calibrationDatasetItemsStore.set(dataset.id, items);
    }
  }

  static getDatasetById(datasetId: string): CalibrationDataset | undefined {
    return calibrationDatasetsStore.get(datasetId);
  }

  static listDatasets(organizationId?: string): CalibrationDataset[] {
    const list = Array.from(calibrationDatasetsStore.values());
    if (organizationId) {
      return list.filter((d) => d.organization_id === organizationId);
    }
    return list;
  }

  static createDataset(dataset: Omit<CalibrationDataset, "id" | "created_at">): CalibrationDataset {
    const newDataset: CalibrationDataset = {
      ...dataset,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    calibrationDatasetsStore.set(newDataset.id, newDataset);
    return newDataset;
  }

  static freezeDataset(datasetId: string, userContext: UserAuthContext): CalibrationDataset {
    const ds = calibrationDatasetsStore.get(datasetId);
    if (!ds) throw new Error(`Calibration dataset [${datasetId}] not found.`);
    AuthorizationService.assertOrgAccess(userContext, ds.organization_id);

    ds.status = "FROZEN";
    ds.frozen_at = new Date().toISOString();
    calibrationDatasetsStore.set(datasetId, ds);
    return ds;
  }

  /**
   * Seeds a review directly into the store.
   */
  static seedReview(review: StoredAuditReview): void {
    reviewsStore.set(review.id, review);
    auditToReviewIndex.set(review.audit_id, review.id);
  }

  /**
   * Seeds gold labels using deterministic logical identity keys (Section 5)
   */
  static seedGoldLabels(labels: QAGoldLabel[]): void {
    for (const l of labels) {
      const key = ReviewService.buildGoldLabelKey(l);
      goldLabelsStore.set(key, l);
    }
  }
}

let benchmarkDatasetInitialized = false;
export function ensureBenchmarkDatasetSeeded(): void {
  if (benchmarkDatasetInitialized) return;
  try {
    // Register synthetic benchmark dataset
    ReviewService.seedDataset(SYNTHETIC_TELECOM_BENCHMARK_V1);

    const items: CalibrationDatasetItem[] = [];
    for (const item of GOLD_BENCHMARK_DATASET) {
      CallService.updateCall(item.call);
      AuditService.setStoredAudit(item.audit);
      ReviewService.seedReview(item.review);
      ReviewService.seedGoldLabels(item.goldLabels);

      items.push({
        id: crypto.randomUUID(),
        dataset_id: SYNTHETIC_TELECOM_BENCHMARK_V1.id,
        call_id: item.call.id,
        audit_id: item.audit.id,
        review_id: item.review.id,
        transcript_id: item.transcript.id,
        created_at: new Date().toISOString(),
      });
    }
    ReviewService.seedDataset(SYNTHETIC_TELECOM_BENCHMARK_V1, items);

    benchmarkDatasetInitialized = true;
  } catch (err) {
    console.error("Failed to seed benchmark dataset:", err);
  }
}
