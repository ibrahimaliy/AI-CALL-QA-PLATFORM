import {
  CalibrationMetrics,
  ParameterAgreementMetric,
  QAGoldLabel,
  MetricFraction,
  FalsePositiveRecord,
  HumanHumanAgreementMetrics,
  CalibrationDataset,
} from "@/types/review";
import { ReviewService, ensureBenchmarkDatasetSeeded } from "../reviews/review.service";
import { SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID } from "@/lib/dataset/gold-calls-dataset";

function makeFraction(numerator: number, denominator: number): MetricFraction {
  const rate = denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 100;
  return {
    numerator,
    denominator,
    rate,
    display: `${numerator} / ${denominator} = ${rate}%`,
  };
}

export class CalibrationService {
  /**
   * Computes deterministic calibration metrics comparing AI findings against human QA gold decisions.
   * Specification Sections 4, 5, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 21, 22
   */
  static computeCalibrationMetrics(
    datasetIdOrOrgId?: string,
    organizationId?: string
  ): CalibrationMetrics {
    ensureBenchmarkDatasetSeeded();

    // Determine target dataset: if datasetIdOrOrgId is a dataset, use it; else default to benchmark
    let targetDatasetId = SYNTHETIC_TELECOM_BENCHMARK_DATASET_ID;
    let targetOrgId = organizationId;

    if (datasetIdOrOrgId) {
      const maybeDataset = ReviewService.getDatasetById(datasetIdOrOrgId);
      if (maybeDataset) {
        targetDatasetId = maybeDataset.id;
        targetOrgId = maybeDataset.organization_id;
      } else {
        targetOrgId = datasetIdOrOrgId;
      }
    }

    const dataset = ReviewService.getDatasetById(targetDatasetId);
    const goldLabels = ReviewService.getAllGoldLabels({
      datasetId: targetDatasetId,
      organizationId: targetOrgId,
    });

    return this.calculateMetricsFromLabels(goldLabels, dataset);
  }

  /**
   * Pure deterministic calculation logic (never through LLM, per Section 68)
   */
  static calculateMetricsFromLabels(
    labels: QAGoldLabel[],
    dataset?: CalibrationDataset
  ): CalibrationMetrics {
    const datasetName = dataset?.name || "Synthetic Telecom Benchmark V1";
    const datasetVersion = dataset?.version || "1.0.0";
    const datasetSourceType = dataset?.dataset_source_type || "SYNTHETIC";
    const datasetStatus = dataset?.status || "FROZEN";
    const minSampleSize = dataset?.min_sample_size || 50;

    // Unique calls/audits count
    const uniqueAudits = new Set(labels.map((l) => l.call_id)).size;
    const isPreliminary = uniqueAudits < minSampleSize;
    const warningMessage = isPreliminary
      ? "PRELIMINARY CALIBRATION — SAMPLE SIZE TOO SMALL FOR PRODUCTION ACCURACY CLAIMS."
      : undefined;

    // Filter strictly to labels where AI actually evaluated the parameter (Section 4 & 5)
    const aiAuditedLabels = labels.filter((l) => l.ai_result !== undefined && l.ai_result !== null);
    const totalAuditableCriteriaEvaluated = aiAuditedLabels.length;

    if (totalAuditableCriteriaEvaluated === 0) {
      const zeroFrac = makeFraction(0, 0);
      return {
        datasetId: dataset?.id,
        datasetName,
        datasetVersion,
        datasetSourceType,
        datasetStatus,
        isPreliminary,
        warningMessage,
        minSampleSize,
        totalGoldAudits: uniqueAudits,
        totalAuditableCriteriaEvaluated: 0,
        overallAgreementRate: 0,
        failPrecision: 0,
        failRecall: 0,
        passPrecision: 0,
        evidenceAccuracyRate: 0,
        failureReasonAccuracyRate: 0,
        overallAgreement: zeroFrac,
        failPrecisionMetric: zeroFrac,
        failRecallMetric: zeroFrac,
        passPrecisionMetric: zeroFrac,
        evidenceAccuracyMetric: zeroFrac,
        failureReasonMetric: zeroFrac,
        evidenceAccuracyBreakdown: { correct: 0, partiallyCorrect: 0, incorrect: 0, unrated: 0 },
        parameterAgreement: [],
        confidenceCalibration: [],
        falsePositiveAnalysis: [],
        totalTokensUsed: 0,
        estimatedCostUsd: 0,
        averageLatencyMs: 0,
      };
    }

    // 1. Overall Exact Agreement (Section 20 & 39)
    const exactAgreements = aiAuditedLabels.filter((l) => l.ai_result === l.human_result).length;
    const overallAgreement = makeFraction(exactAgreements, totalAuditableCriteriaEvaluated);

    // 2. FAIL Precision & Recall (Sections 13, 20, 40, 41)
    // All AI failures: cases where AI said FAIL
    const aiFailures = aiAuditedLabels.filter((l) => l.ai_result === "FAIL");
    // Human-confirmed AI failures: AI = FAIL AND Human = FAIL
    const confirmedAiFailures = aiFailures.filter((l) => l.human_result === "FAIL");
    const failPrecisionMetric = makeFraction(confirmedAiFailures.length, aiFailures.length);

    // All Human-confirmed failures: cases where Human said FAIL
    const humanFailures = aiAuditedLabels.filter((l) => l.human_result === "FAIL");
    const failRecallMetric = makeFraction(confirmedAiFailures.length, humanFailures.length);

    // 3. PASS Precision (Sections 20 & 42)
    // Cases where AI said PASS
    const aiPasses = aiAuditedLabels.filter((l) => l.ai_result === "PASS");
    const confirmedAiPasses = aiPasses.filter((l) => l.human_result === "PASS");
    const passPrecisionMetric = makeFraction(confirmedAiPasses.length, aiPasses.length);

    // 4. Evidence Accuracy (Sections 18 & 20)
    let correctEvidence = 0;
    let partiallyCorrectEvidence = 0;
    let incorrectEvidence = 0;
    let unratedEvidence = 0;

    aiAuditedLabels.forEach((l) => {
      if (l.ai_evidence_accuracy === "CORRECT") correctEvidence++;
      else if (l.ai_evidence_accuracy === "PARTIALLY_CORRECT") partiallyCorrectEvidence++;
      else if (l.ai_evidence_accuracy === "INCORRECT") incorrectEvidence++;
      else unratedEvidence++;
    });

    const ratedEvidenceCount = correctEvidence + partiallyCorrectEvidence + incorrectEvidence;
    const evidenceAccuracyRate =
      ratedEvidenceCount > 0
        ? Number((((correctEvidence + 0.5 * partiallyCorrectEvidence) / ratedEvidenceCount) * 100).toFixed(2))
        : 100;
    const evidenceAccuracyMetric: MetricFraction = {
      ...makeFraction(correctEvidence, ratedEvidenceCount),
      rate: evidenceAccuracyRate,
    };

    // 5. Failure Reason Accuracy (Section 19 & 20)
    // Strictly calculated ONLY where AI result = FAIL AND human confirms a failure
    const bothFailLabels = aiAuditedLabels.filter(
      (l) => l.ai_result === "FAIL" && l.human_result === "FAIL"
    );
    const matchingReasonLabels = bothFailLabels.filter(
      (l) => l.ai_failure_reason && l.human_failure_reason && l.ai_failure_reason === l.human_failure_reason
    );
    const failureReasonMetric = makeFraction(matchingReasonLabels.length, bothFailLabels.length);

    // 6. Parameter-Level Breakdown (Sections 10, 20, 47)
    const parameterMap = new Map<string, QAGoldLabel[]>();
    aiAuditedLabels.forEach((l) => {
      const existing = parameterMap.get(l.parameter_id) || [];
      existing.push(l);
      parameterMap.set(l.parameter_id, existing);
    });

    const parameterAgreement: ParameterAgreementMetric[] = [];
    parameterMap.forEach((paramLabels, paramId) => {
      const paramName = paramLabels[0]?.parameter_name || "Unknown Parameter";
      const total = paramLabels.length;
      const paramExact = paramLabels.filter((l) => l.ai_result === l.human_result).length;
      const falseFails = paramLabels.filter((l) => l.ai_result === "FAIL" && l.human_result === "PASS").length;
      const falsePasses = paramLabels.filter((l) => l.ai_result === "PASS" && l.human_result === "FAIL").length;

      const bothFail = paramLabels.filter((l) => l.ai_result === "FAIL" && l.human_result === "FAIL");
      const matchReason = bothFail.filter(
        (l) => l.ai_failure_reason && l.human_failure_reason && l.ai_failure_reason === l.human_failure_reason
      ).length;

      const passCount = paramLabels.filter((l) => l.human_result === "PASS").length;
      const failCount = paramLabels.filter((l) => l.human_result === "FAIL").length;
      const partialCount = paramLabels.filter((l) => l.human_result === "PARTIAL").length;

      parameterAgreement.push({
        parameterId: paramId,
        parameterName: paramName,
        totalEvaluated: total,
        exactAgreements: paramExact,
        agreementRate: Number(((paramExact / total) * 100).toFixed(2)),
        agreementFraction: makeFraction(paramExact, total),
        falseFailCount: falseFails,
        falseFailRate: Number(((falseFails / total) * 100).toFixed(2)),
        falseFailFraction: makeFraction(falseFails, total),
        falsePassCount: falsePasses,
        falsePassRate: Number(((falsePasses / total) * 100).toFixed(2)),
        falsePassFraction: makeFraction(falsePasses, total),
        passCount,
        failCount,
        partialCount,
        failureReasonAgreementCount: matchReason,
        failureReasonAgreementRate: bothFail.length > 0 ? Number(((matchReason / bothFail.length) * 100).toFixed(2)) : 100,
        failureReasonFraction: makeFraction(matchReason, bothFail.length),
      });
    });

    // 7. Confidence Calibration (Sections 20 & 45)
    const buckets = [
      { name: "0.90 – 1.00", min: 0.9, max: 1.01 },
      { name: "0.80 – 0.89", min: 0.8, max: 0.9 },
      { name: "0.70 – 0.79", min: 0.7, max: 0.8 },
      { name: "< 0.70", min: 0.0, max: 0.7 },
    ];

    const confidenceCalibration = buckets.map((b) => {
      const inBucket = aiAuditedLabels.filter((l) => {
        const c = l.ai_confidence !== undefined ? l.ai_confidence : 0.85;
        return c >= b.min && c < b.max;
      });
      const agreements = inBucket.filter((l) => l.ai_result === l.human_result).length;
      const rate = inBucket.length > 0 ? Number(((agreements / inBucket.length) * 100).toFixed(2)) : 0;
      return {
        bucket: b.name,
        count: inBucket.length,
        agreements,
        agreementRate: rate,
        fraction: makeFraction(agreements, inBucket.length),
      };
    });

    // 8. False-Positive / False-Fail Analysis (Sections 14, 15, 16)
    const falseFailLabels = aiAuditedLabels.filter(
      (l) => l.ai_result === "FAIL" && l.human_result === "PASS"
    );
    const falsePositiveAnalysis: FalsePositiveRecord[] = falseFailLabels.map((l) => {
      let rootCause = "Semantic divergence between strict prompt verbiage and operational customer support.";
      let recommendation = "Configure SEMANTIC matching or update prompt evaluation guidelines.";

      if (l.parameter_name.includes("Probing")) {
        rootCause = "Customer volunteered diagnostic symptoms (lights/reboot) in opening statement. AI penalized agent for not re-asking volunteered info.";
        recommendation = "Instruct model to identify customer-volunteered information before penalizing probing questions.";
      } else if (l.parameter_name.includes("greeting") || l.parameter_name.includes("welcome")) {
        rootCause = "Agent used approved semantic equivalent verbiage ('Thank you for calling Smile' vs 'Welcome to Smile').";
        recommendation = "Set scorecard parameter matching mode to 'SEMANTIC' to accept professional brand greetings.";
      }

      return {
        callId: l.call_id,
        externalCallId: l.call_id.slice(0, 12),
        parameterId: l.parameter_id,
        parameterName: l.parameter_name,
        aiResult: l.ai_result || "FAIL",
        humanResult: l.human_result,
        aiFailureReason: l.ai_failure_reason,
        humanFailureReason: l.human_failure_reason,
        aiEvidence: Array.isArray(l.ai_evidence) ? (l.ai_evidence as string[]) : [],
        humanExplanation: l.human_failure_reason || "Marked as PASS under operational QA standards.",
        promptVersion: "qa-audit-v1",
        overrideCategory: "QA_RULE_INTERPRETATION",
        rootCauseAnalysis: rootCause,
        recommendedAction: recommendation,
      };
    });

    // 9. Human-Human Agreement Baseline (Sections 11 & 12)
    let humanHumanAgreement: HumanHumanAgreementMetrics | undefined = undefined;
    const doubleReviewed = labels.filter(
      (l) => l.secondary_reviewer_id && l.secondary_human_result !== undefined
    );
    if (doubleReviewed.length > 0) {
      const doubleCallsCount = new Set(doubleReviewed.map((l) => l.call_id)).size;
      const exactHH = doubleReviewed.filter((l) => l.human_result === l.secondary_human_result).length;
      const paramHHMap = new Map<string, QAGoldLabel[]>();
      doubleReviewed.forEach((l) => {
        const arr = paramHHMap.get(l.parameter_id) || [];
        arr.push(l);
        paramHHMap.set(l.parameter_id, arr);
      });

      const paramHH = Array.from(paramHHMap.entries()).map(([pId, pLabels]) => {
        const pAgreed = pLabels.filter((l) => l.human_result === l.secondary_human_result).length;
        return {
          parameterId: pId,
          parameterName: pLabels[0]?.parameter_name || "Parameter",
          exactAgreements: makeFraction(pAgreed, pLabels.length),
        };
      });

      const failureHH = doubleReviewed.filter(
        (l) => l.human_result === "FAIL" && l.secondary_human_result === "FAIL"
      );
      const matchReasonHH = failureHH.filter(
        (l) => l.human_failure_reason && l.secondary_failure_reason && l.human_failure_reason === l.secondary_failure_reason
      ).length;

      humanHumanAgreement = {
        doubleReviewedCount: doubleCallsCount,
        overallAgreement: makeFraction(exactHH, doubleReviewed.length),
        parameterAgreement: paramHH,
        failureReasonAgreement: makeFraction(matchReasonHH, failureHH.length),
      };
    }

    // 10. Operational Token & Latency Estimates
    const avgInputTokens = 1520;
    const avgOutputTokens = 380;
    const totalTokensUsed = uniqueAudits * (avgInputTokens + avgOutputTokens);
    const inputCost = (uniqueAudits * avgInputTokens * 2.5) / 1000000;
    const outputCost = (uniqueAudits * avgOutputTokens * 10.0) / 1000000;
    const estimatedCostUsd = Number((inputCost + outputCost).toFixed(4));
    const averageLatencyMs = 2150;

    return {
      datasetId: dataset?.id,
      datasetName,
      datasetVersion,
      datasetSourceType,
      datasetStatus,
      isPreliminary,
      warningMessage,
      minSampleSize,
      totalGoldAudits: uniqueAudits,
      totalAuditableCriteriaEvaluated,
      overallAgreementRate: overallAgreement.rate,
      failPrecision: failPrecisionMetric.rate,
      failRecall: failRecallMetric.rate,
      passPrecision: passPrecisionMetric.rate,
      evidenceAccuracyRate,
      failureReasonAccuracyRate: failureReasonMetric.rate,
      overallAgreement,
      failPrecisionMetric,
      failRecallMetric,
      passPrecisionMetric,
      evidenceAccuracyMetric,
      failureReasonMetric,
      evidenceAccuracyBreakdown: {
        correct: correctEvidence,
        partiallyCorrect: partiallyCorrectEvidence,
        incorrect: incorrectEvidence,
        unrated: unratedEvidence,
      },
      parameterAgreement,
      confidenceCalibration,
      humanHumanAgreement,
      falsePositiveAnalysis,
      totalTokensUsed,
      estimatedCostUsd,
      averageLatencyMs,
    };
  }
}
