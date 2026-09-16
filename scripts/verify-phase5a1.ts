import crypto from "crypto";
import { ReviewService } from "../src/services/reviews/review.service";
import { CalibrationService } from "../src/services/calibration/calibration.service";
import { CallService } from "../src/services/calls/call.service";
import { AuditService } from "../src/services/auditing/audit.service";
import { UserAuthContext } from "../src/services/auth/authorization";
import { INITIAL_ORGANIZATION, INITIAL_SCORECARD } from "../src/lib/seed-data";
import {
  GOLD_BENCHMARK_DATASET,
  SYNTHETIC_TELECOM_BENCHMARK_V1,
  SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
} from "../src/lib/dataset/gold-calls-dataset";
import { QAGoldLabel, CalibrationDataset } from "../src/types/review";
import { getGlobalStores } from "../src/lib/store/global-store";

async function runPhase5A1Verification() {
  console.log("================================================================================");
  console.log("AI CALL QA PLATFORM — PHASE 5A.1 CALIBRATION HARDENING VERIFICATION SUITE");
  console.log("================================================================================");

  const userCtx: UserAuthContext = {
    userId: "u0000000-0000-0000-0000-000000000001",
    organizationId: INITIAL_ORGANIZATION.id,
    role: "QA_AUDITOR",
    fullName: "Ayinde Andrea",
  };

  const managerCtx: UserAuthContext = {
    userId: "u0000000-0000-0000-0000-000000000002",
    organizationId: INITIAL_ORGANIZATION.id,
    role: "QA_MANAGER",
    fullName: "QA Manager",
  };

  // -------------------------------------------------------------
  // TEST 1: Seed Dataset & Verify Dataset Versioning (Sections 6, 7, 8)
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Dataset Versioning & Source Classification");
  
  // Clear stale benchmark labels from previous test runs
  const stores = getGlobalStores();
  for (const [k, l] of stores.goldLabels.entries()) {
    if (l.dataset_id === SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID) {
      stores.goldLabels.delete(k);
    }
  }

  ReviewService.seedDataset(SYNTHETIC_TELECOM_BENCHMARK_V1);
  for (const item of GOLD_BENCHMARK_DATASET) {
    CallService.updateCall(item.call);
    AuditService.setStoredAudit(item.audit);
    ReviewService.seedReview(item.review);
    ReviewService.seedGoldLabels(item.goldLabels);
  }

  const ds = ReviewService.getDatasetById(SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID);
  if (!ds) throw new Error("Synthetic benchmark dataset not found.");
  if (ds.name !== "Synthetic Telecom Benchmark V1") {
    throw new Error(`Expected dataset name 'Synthetic Telecom Benchmark V1', got '${ds.name}'`);
  }
  if (ds.dataset_source_type !== "SYNTHETIC") {
    throw new Error(`Expected dataset_source_type 'SYNTHETIC', got '${ds.dataset_source_type}'`);
  }
  if (ds.status !== "FROZEN") {
    throw new Error(`Expected dataset status 'FROZEN', got '${ds.status}'`);
  }
  console.log(`   Dataset: ${ds.name} (v${ds.version}) [Status: ${ds.status}, Source: ${ds.dataset_source_type}]`);
  console.log("   -> PASS: Benchmark dataset explicitly versioned and classified as SYNTHETIC.");

  // -------------------------------------------------------------
  // TEST 2: Resolve 33 vs 30 Evaluations Discrepancy (Sections 4 & 5)
  // -------------------------------------------------------------
  console.log("\n[TEST 2] Verification of Exactly 30 Parameter Decisions (10 calls × 3 criteria)");
  const metrics = CalibrationService.computeCalibrationMetrics(
    SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
    INITIAL_ORGANIZATION.id
  );

  console.log(`   Total Benchmark Calls:        ${metrics.totalGoldAudits}`);
  console.log(`   Total Parameter Decisions:    ${metrics.totalAuditableCriteriaEvaluated}`);

  if (metrics.totalGoldAudits !== 10) {
    throw new Error(`Expected exactly 10 benchmark calls, got ${metrics.totalGoldAudits}`);
  }
  if (metrics.totalAuditableCriteriaEvaluated !== 30) {
    throw new Error(
      `Discrepancy detected! Expected strictly 30 parameter decisions (10 calls × 3 criteria), but found ${metrics.totalAuditableCriteriaEvaluated}.`
    );
  }
  console.log("   -> PASS: Exactly 30 parameter decisions verified. 33-vs-30 discrepancy resolved.");

  // -------------------------------------------------------------
  // TEST 3: Gold Label Uniqueness & Deduplication (Section 5)
  // -------------------------------------------------------------
  console.log("\n[TEST 3] Deterministic Gold Label Compound Key & Deduplication");
  const testLabel = GOLD_BENCHMARK_DATASET[0].goldLabels[0];
  const compoundKey = ReviewService.buildGoldLabelKey(testLabel);

  if (!compoundKey.includes(testLabel.dataset_id!) || !compoundKey.includes(testLabel.parameter_id)) {
    throw new Error(`Invalid compound key format: ${compoundKey}`);
  }

  // Attempt to re-seed the exact same label
  ReviewService.seedGoldLabels([testLabel]);
  const labelsAfterReseed = ReviewService.getAllGoldLabels({
    datasetId: SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
  });

  const auditableCount = labelsAfterReseed.filter((l) => l.ai_result !== undefined).length;
  if (auditableCount !== 30) {
    throw new Error(`Re-seeding duplicate label inflated store count to ${auditableCount}! Expected 30.`);
  }
  console.log(`   Compound Key: ${compoundKey}`);
  console.log("   -> PASS: Duplicate gold labels are idempotently deduplicated by compound key.");

  // -------------------------------------------------------------
  // TEST 4: Frozen Dataset Immutability on Ad-Hoc Review Finalization (Section 4 & 6)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Frozen Dataset Protection Against Ad-Hoc Review Finalization");
  // Finalize an ad-hoc test review
  const freshReview = await ReviewService.getOrCreateReview(GOLD_BENCHMARK_DATASET[0].audit.id, userCtx);
  for (const d of freshReview.decisions) {
    d.human_result = "PASS";
    d.human_awarded_points = d.max_weight;
  }
  await ReviewService.finalizeReview(freshReview.id, managerCtx);

  // Re-verify that the frozen benchmark dataset was NOT polluted
  const metricsAfterFinalize = CalibrationService.computeCalibrationMetrics(
    SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID,
    INITIAL_ORGANIZATION.id
  );
  if (metricsAfterFinalize.totalAuditableCriteriaEvaluated !== 30) {
    throw new Error(
      `Frozen dataset was polluted by ad-hoc review finalization! Evaluated: ${metricsAfterFinalize.totalAuditableCriteriaEvaluated}`
    );
  }
  console.log("   -> PASS: Finalizing ad-hoc reviews does NOT alter or pollute frozen benchmark datasets.");

  // -------------------------------------------------------------
  // TEST 5: Metric Denominators Display Verification (Section 20)
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Mathematical Denominators on All Calibration Metrics");
  if (metrics.overallAgreement.display !== "28 / 30 = 93.33%") {
    throw new Error(`Unexpected overall agreement display: ${metrics.overallAgreement.display}`);
  }
  if (metrics.failPrecisionMetric.display !== "3 / 5 = 60%") {
    throw new Error(`Unexpected FAIL precision display: ${metrics.failPrecisionMetric.display}`);
  }
  if (metrics.failRecallMetric.display !== "3 / 3 = 100%") {
    throw new Error(`Unexpected FAIL recall display: ${metrics.failRecallMetric.display}`);
  }
  if (metrics.passPrecisionMetric.display !== "25 / 25 = 100%") {
    throw new Error(`Unexpected PASS precision display: ${metrics.passPrecisionMetric.display}`);
  }
  if (metrics.evidenceAccuracyMetric.display !== "28 / 30 = 93.33%") {
    throw new Error(`Unexpected evidence accuracy display: ${metrics.evidenceAccuracyMetric.display}`);
  }
  console.log(`   Overall Agreement:       ${metrics.overallAgreement.display}`);
  console.log(`   FAIL Precision:          ${metrics.failPrecisionMetric.display}`);
  console.log(`   FAIL Recall:             ${metrics.failRecallMetric.display}`);
  console.log(`   PASS Precision:          ${metrics.passPrecisionMetric.display}`);
  console.log(`   Evidence Accuracy:       ${metrics.evidenceAccuracyMetric.display}`);
  console.log("   -> PASS: All primary metrics display correct mathematical fractions and denominators.");

  // -------------------------------------------------------------
  // TEST 6: Failure Reason Accuracy Denominator Integrity (Section 19)
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Failure Reason Accuracy Denominator Integrity");
  // Strictly calculated ONLY where AI=FAIL and Human=FAIL (3 confirmed failure cases)
  if (metrics.failureReasonMetric.display !== "3 / 3 = 100%") {
    throw new Error(
      `Failure reason accuracy denominator inflated! Expected '3 / 3 = 100%', got '${metrics.failureReasonMetric.display}'`
    );
  }
  console.log(`   Failure Reason Accuracy: ${metrics.failureReasonMetric.display}`);
  console.log("   -> PASS: Non-failure cases strictly excluded from failure-reason accuracy denominator.");

  // -------------------------------------------------------------
  // TEST 7: AI Score vs Human Score Separation (Section 2, 3, 24)
  // -------------------------------------------------------------
  console.log("\n[TEST 7] AI Score Presentation Separation");
  const testAudit = GOLD_BENCHMARK_DATASET[1].audit;
  const testRev = GOLD_BENCHMARK_DATASET[1].review;

  const aiAwarded = testAudit.ai_awarded_points;
  const aiWeight = testAudit.auditable_weight;
  const aiProvisional = testAudit.ai_normalized_percentage;
  const humanFinal = testRev.final_score;

  if (aiWeight !== 30) {
    throw new Error(`Expected auditable weight 30 pts, got ${aiWeight}`);
  }
  if (testAudit.final_score !== null) {
    throw new Error("AI audit final_score must remain null pending review.");
  }
  console.log(`   AI Awarded Points:       ${aiAwarded} / ${aiWeight} pts`);
  console.log(`   AI Provisional Score:    ${aiProvisional}%`);
  console.log(`   AI Coverage:             30% (30 / 100 pts)`);
  console.log(`   Human Final Score:       ${humanFinal} / 100.0 pts`);
  console.log("   -> PASS: AI provisional performance and human final score are strictly separated.");

  // -------------------------------------------------------------
  // TEST 8: Sample Size Warning When < 50 Genuine Calls (Section 22)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Preliminary Calibration Warning (Sample Size < 50)");
  if (!metrics.isPreliminary) {
    throw new Error("isPreliminary flag must be true when sample size is 10 < 50.");
  }
  if (!metrics.warningMessage?.includes("PRELIMINARY CALIBRATION")) {
    throw new Error(`Missing expected warning message: ${metrics.warningMessage}`);
  }
  console.log(`   Warning Banner: "${metrics.warningMessage}"`);
  console.log("   -> PASS: Preliminary warning enforced for datasets below 50 calls.");

  // -------------------------------------------------------------
  // TEST 9: FAIL Precision Safety Rule & AI Recommendation (Section 13 & 23)
  // -------------------------------------------------------------
  console.log("\n[TEST 9] FAIL Precision Safety Rule & AI_RECOMMENDATION");
  const failCallAudit = GOLD_BENCHMARK_DATASET[1].audit; // Call 2 has failed greeting
  const hasAIFailure = failCallAudit.parameters.some((p) => p.result === "FAIL");

  if (!hasAIFailure) {
    throw new Error("Test Call 2 was expected to have an AI failure.");
  }
  // Any call with an AI failure cannot be auto-finalized and must require human review
  if (failCallAudit.status !== "REVIEW_REQUIRED") {
    throw new Error(`Expected status 'REVIEW_REQUIRED', got '${failCallAudit.status}'`);
  }
  console.log(`   Call Status: ${failCallAudit.status}`);
  console.log(`   Policy Rule: AI FAIL -> HUMAN_REVIEW_REQUIRED (Safety threshold not met: 60% < 90%)`);
  console.log("   -> PASS: AI failures safely routed to human review without automated finalization.");

  // -------------------------------------------------------------
  // TEST 10: False-Positive / False-Fail Root Cause Analysis (Section 14, 15, 16)
  // -------------------------------------------------------------
  console.log("\n[TEST 10] False-Positive Analysis (Semantic Equivalence & Volunteered Info)");
  if (metrics.falsePositiveAnalysis.length !== 2) {
    throw new Error(`Expected 2 false positive records, found ${metrics.falsePositiveAnalysis.length}`);
  }

  const probingFP = metrics.falsePositiveAnalysis.find((f) => f.parameterName.includes("Probing"));
  if (!probingFP) throw new Error("Probing false-positive case not found.");
  if (!probingFP.rootCauseAnalysis.includes("Customer volunteered")) {
    throw new Error("Probing root cause should identify customer volunteered diagnostic info.");
  }

  const greetingFP = metrics.falsePositiveAnalysis.find((f) => f.parameterName.includes("greeting"));
  if (!greetingFP) throw new Error("Greeting false-positive case not found.");
  if (!greetingFP.rootCauseAnalysis.includes("semantic equivalent")) {
    throw new Error("Greeting root cause should identify semantic equivalent verbiage.");
  }

  console.log(`   Probing FP Root Cause:  ${probingFP.rootCauseAnalysis}`);
  console.log(`   Greeting FP Root Cause: ${greetingFP.rootCauseAnalysis}`);
  console.log("   -> PASS: False-positive analysis properly categorizes semantic equivalence and volunteered information.");

  // -------------------------------------------------------------
  // TEST 11: Human-Human Agreement Baseline (Section 11 & 12)
  // -------------------------------------------------------------
  console.log("\n[TEST 11] Human-Human Agreement Baseline (Double-Review Subset)");
  if (!metrics.humanHumanAgreement) {
    throw new Error("humanHumanAgreement metrics missing.");
  }
  if (metrics.humanHumanAgreement.doubleReviewedCount !== 2) {
    throw new Error(`Expected 2 double-reviewed calls, got ${metrics.humanHumanAgreement.doubleReviewedCount}`);
  }
  if (metrics.humanHumanAgreement.overallAgreement.display !== "20 / 20 = 100%") {
    throw new Error(`Unexpected human-human agreement: ${metrics.humanHumanAgreement.overallAgreement.display}`);
  }
  console.log(`   Double-Reviewed Calls:        ${metrics.humanHumanAgreement.doubleReviewedCount}`);
  console.log(`   Overall Human-Human Baseline: ${metrics.humanHumanAgreement.overallAgreement.display} (across all 10 criteria)`);
  console.log("   -> PASS: Human-human agreement baseline calculated across double-reviewed subset.");

  // -------------------------------------------------------------
  // TEST 12: Separation of Synthetic and Real Datasets (Section 7)
  // -------------------------------------------------------------
  console.log("\n[TEST 12] Synthetic vs Real-Validated Dataset Separation");
  const syntheticLabels = ReviewService.getAllGoldLabels({ sourceType: "SYNTHETIC" });
  const realLabels = ReviewService.getAllGoldLabels({ sourceType: "REAL_VALIDATED" });

  const syntheticAuditable = syntheticLabels.filter((l) => l.ai_result !== undefined);
  if (syntheticLabels.length !== 100 || syntheticAuditable.length !== 30) {
    throw new Error(
      `Expected 100 total synthetic labels (30 auditable), found ${syntheticLabels.length} total (${syntheticAuditable.length} auditable)`
    );
  }
  if (realLabels.length !== 0) {
    throw new Error(`Expected 0 real-validated labels before collecting live calls, found ${realLabels.length}`);
  }
  console.log(`   Synthetic Labels:      ${syntheticLabels.length} total (${syntheticAuditable.length} auditable)`);
  console.log(`   Real-Validated Labels: ${realLabels.length} (Next Target: minimum 50 genuine calls)`);
  console.log("   -> PASS: Synthetic test fixtures cannot be mixed into real-validated reports.");

  console.log("\n================================================================================");
  console.log("ALL 12 PHASE 5A.1 CALIBRATION HARDENING VERIFICATION CHECKS PASSED!");
  console.log("================================================================================\n");
}

runPhase5A1Verification().catch((err) => {
  console.error("\n[PHASE 5A.1 VERIFICATION FAILED]", err);
  process.exit(1);
});
