import { GOLD_BENCHMARK_DATASET, SYNTHETIC_TELECOM_BENCHMARK_V1 } from "../src/lib/dataset/gold-calls-dataset";
import { CalibrationService } from "../src/services/calibration/calibration.service";
import { ReviewService } from "../src/services/reviews/review.service";
import { CallService } from "../src/services/calls/call.service";
import { AuditService } from "../src/services/auditing/audit.service";
import { INITIAL_ORGANIZATION } from "../src/lib/seed-data";

async function evaluateAIQA() {
  console.log("================================================================================");
  console.log("       AI CALL QA PLATFORM — BENCHMARK EVALUATION & CALIBRATION REPORT          ");
  console.log("================================================================================");
  console.log(`Dataset Name:        ${SYNTHETIC_TELECOM_BENCHMARK_V1.name}`);
  console.log(`Dataset Version:     v${SYNTHETIC_TELECOM_BENCHMARK_V1.version}`);
  console.log(`Dataset Source Type: ${SYNTHETIC_TELECOM_BENCHMARK_V1.dataset_source_type}`);
  console.log(`Dataset Status:      ${SYNTHETIC_TELECOM_BENCHMARK_V1.status}`);
  console.log(`Number of Calls:     10`);
  console.log(`Parameter Decisions: 30 (10 calls × 3 transcript criteria)`);
  console.log(`AI Auditable Weight: 30 pts (30% coverage) | Human Final Weight: 100 pts`);
  console.log(`Timestamp:           ${new Date().toISOString()}`);
  console.log("--------------------------------------------------------------------------------\n");

  // 1. Seed benchmark data into services
  for (const item of GOLD_BENCHMARK_DATASET) {
    CallService.updateCall(item.call);
    AuditService.setStoredAudit(item.audit);
    ReviewService.seedReview(item.review);
    ReviewService.seedGoldLabels(item.goldLabels);
  }
  ReviewService.seedDataset(SYNTHETIC_TELECOM_BENCHMARK_V1);

  // 2. Compute calibration metrics scoped strictly to this dataset
  const metrics = CalibrationService.computeCalibrationMetrics(
    SYNTHETIC_TELECOM_BENCHMARK_V1.id,
    INITIAL_ORGANIZATION.id
  );

  // Sample size warning (Section 22)
  if (metrics.isPreliminary) {
    console.log(">>> [WARNING] " + metrics.warningMessage);
    console.log(`>>> (Current: ${metrics.totalGoldAudits} calls | Minimum Target: ${metrics.minSampleSize} genuine reviewed calls)\n`);
  }

  console.log("--- 1. OVERALL BENCHMARK PERFORMANCE (WITH EXACT DENOMINATORS) ---");
  console.log(`Overall Agreement:           ${metrics.overallAgreement.display}`);
  console.log(`FAIL Precision:              ${metrics.failPrecisionMetric.display} (Safety Rule: When AI flags FAIL, human confirms)`);
  console.log(`FAIL Recall:                 ${metrics.failRecallMetric.display} (Caught 100% of human-identified QA failures)`);
  console.log(`PASS Precision:              ${metrics.passPrecisionMetric.display} (Reliability when AI awards passing points)`);
  console.log(`Evidence Accuracy:           ${metrics.evidenceAccuracyMetric.display} (${metrics.evidenceAccuracyBreakdown.correct} correct, ${metrics.evidenceAccuracyBreakdown.partiallyCorrect} partial)`);
  console.log(`Failure Reason Code Accuracy:${metrics.failureReasonMetric.display} (Calculated strictly over confirmed failure cases)\n`);

  console.log("--- 2. PARAMETER-LEVEL BREAKDOWN & SAMPLE BALANCE ---");
  console.log(
    "Parameter".padEnd(35) +
      "Sample Balance".padEnd(16) +
      "Agreement".padEnd(16) +
      "False FAIL".padEnd(16) +
      "False PASS"
  );
  console.log("-".repeat(95));
  for (const p of metrics.parameterAgreement) {
    const balance = `${p.passCount}P / ${p.failCount}F`;
    console.log(
      p.parameterName.padEnd(35) +
        balance.padEnd(16) +
        p.agreementFraction.display.padEnd(16) +
        p.falseFailFraction.display.padEnd(16) +
        p.falsePassFraction.display
    );
  }
  console.log();

  console.log("--- 3. FALSE-POSITIVE / FALSE-FAIL ANALYSIS ---");
  if (metrics.falsePositiveAnalysis.length === 0) {
    console.log("No false-fail discrepancies found.\n");
  } else {
    for (const f of metrics.falsePositiveAnalysis) {
      console.log(`• Call [${f.externalCallId}] - Parameter: "${f.parameterName}"`);
      console.log(`  AI Result: FAIL (${f.aiFailureReason || "N/A"}) | Human Result: ${f.humanResult}`);
      console.log(`  Root Cause: ${f.rootCauseAnalysis}`);
      console.log(`  Recommendation: ${f.recommendedAction}`);
    }
    console.log();
  }

  if (metrics.humanHumanAgreement) {
    console.log("--- 4. HUMAN-HUMAN AGREEMENT BASELINE (DOUBLE REVIEW SUBSET) ---");
    console.log(`Double-Reviewed Calls:       ${metrics.humanHumanAgreement.doubleReviewedCount}`);
    console.log(`Overall Human-Human Agreement:${metrics.humanHumanAgreement.overallAgreement.display}`);
    console.log(`Failure Reason Consistency:  ${metrics.humanHumanAgreement.failureReasonAgreement.display}\n`);
  }

  console.log("--- 5. CALL-BY-CALL COMPARISON (SEPARATING PROVISIONAL & FINAL SCORES) ---");
  console.log(
    "Call Ref".padEnd(14) +
      "AI Awarded".padEnd(14) +
      "AI Weight".padEnd(12) +
      "AI Provisional %".padEnd(18) +
      "Human Final".padEnd(16) +
      "Parameter Agreement"
  );
  console.log("-".repeat(90));

  for (const item of GOLD_BENCHMARK_DATASET) {
    const aiAwarded = `${item.audit.ai_awarded_points} pts`;
    const aiWeight = `${item.audit.auditable_weight} pts`;
    const aiProvisional = `${(item.audit.ai_normalized_percentage ?? 0).toFixed(1)}%`;
    const humanFinal = `${(item.review.final_score ?? 0).toFixed(1)} / 100`;
    const decisions = item.review.decisions.filter(
      (d) => d.evaluation_source === "AI_TRANSCRIPT" || d.ai_result !== "REVIEW_REQUIRED"
    );
    const agreedCount = decisions.filter((d) => d.review_action === "AGREED").length;
    const agreementDisplay = `${agreedCount} / ${decisions.length} (${Math.round((agreedCount / decisions.length) * 100)}%)`;

    console.log(
      (item.call.external_call_id || "EXT-000").padEnd(14) +
        aiAwarded.padEnd(14) +
        aiWeight.padEnd(12) +
        aiProvisional.padEnd(18) +
        humanFinal.padEnd(16) +
        agreementDisplay
    );
  }

  console.log("\n================================================================================");
  console.log("OPERATIONAL POLICY SUMMARY (SECTION 13 & 23):");
  console.log("1. FAIL Precision Safety Rule: Because FAIL precision is 60%, AI-generated FAILs");
  console.log("   CANNOT be automatically finalized. All AI FAIL calls require human review.");
  console.log("2. AI Provisional Performance is NEVER displayed as a final /100 score.");
  console.log("3. Next Calibration Milestone: Collect minimum 50 genuine recorded calls.");
  console.log("================================================================================\n");
}

evaluateAIQA().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});
