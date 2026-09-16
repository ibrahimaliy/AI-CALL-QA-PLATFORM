"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Percent,
  ShieldCheck,
  Target,
  Zap,
  DollarSign,
  Clock,
  ArrowRight,
  Database,
  Users,
  Info,
} from "lucide-react";
import { CalibrationMetrics } from "@/types/review";

export default function AICalibrationDashboardPage() {
  const [metrics, setMetrics] = useState<CalibrationMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCalibrationData = async (showLoadingSpinner: boolean = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const res = await fetch("/api/calibration");
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (e) {
      console.error("Failed to load calibration data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCalibrationData(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <div className="text-sm text-slate-400">Computing Deterministic Calibration Metrics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              AI vs Human QA Calibration
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
              Phase 5A.1
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic mathematical calibration measuring AI agreement, false fail/pass rates, and evidence precision against human ground truth.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/reviews"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <span>Review Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => {
              void loadCalibrationData(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {/* SAMPLE SIZE WARNING BANNER (Section 22) */}
      {metrics?.isPreliminary && (
        <div className="p-4 rounded-2xl border border-amber-800/80 bg-amber-950/40 backdrop-blur-md text-amber-200 flex items-start space-x-3 shadow-lg shadow-amber-950/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              PRELIMINARY CALIBRATION — SAMPLE SIZE TOO SMALL FOR PRODUCTION ACCURACY CLAIMS.
            </div>
            <div className="text-xs text-amber-200/80 leading-relaxed">
              Current sample size ({metrics.totalGoldAudits} calls) is below the minimum configured threshold of {metrics.minSampleSize} genuine reviewed calls.
              Synthetic benchmark data is intended for pipeline hardening and must not be used to make production capability assertions.
            </div>
          </div>
        </div>
      )}

      {/* DATASET METADATA CARD (Section 6, 7, 8) */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-800/60 text-purple-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white font-mono">{metrics?.datasetName}</span>
              <span className="text-xs font-mono text-slate-400">v{metrics?.datasetVersion}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-950 text-purple-300 border border-purple-800">
                {metrics?.datasetSourceType}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-950 text-slate-400 border border-slate-800">
                {metrics?.datasetStatus}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Benchmark Dataset: 10 simulated telecom calls • 3 auditable transcript criteria per call • Exactly 30 parameter decisions
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-xs font-mono">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Calls</span>
            <span className="text-white font-bold">{metrics?.totalGoldAudits} / {metrics?.minSampleSize} target</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Parameter Decisions</span>
            <span className="text-cyan-400 font-bold">{metrics?.totalAuditableCriteriaEvaluated} labels</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">AI Auditable Weight</span>
            <span className="text-white font-bold">30 pts (30% coverage)</span>
          </div>
        </div>
      </div>

      {/* PRIMARY KPI CARDS WITH EXACT DENOMINATORS (Section 20) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Agreement */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Overall Agreement</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {metrics?.overallAgreement.display || `${metrics?.overallAgreementRate}%`}
          </div>
          <div className="text-[11px] text-slate-400">
            Exact match across {metrics?.totalAuditableCriteriaEvaluated || 0} parameter decisions
          </div>
        </div>

        {/* FAIL Precision */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">FAIL Precision</span>
            <Target className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {metrics?.failPrecisionMetric.display || `${metrics?.failPrecision}%`}
          </div>
          <div className="text-[11px] text-slate-400">
            When AI flags FAIL, human confirms in {metrics?.failPrecision}% of cases
          </div>
        </div>

        {/* FAIL Recall */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">FAIL Recall</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {metrics?.failRecallMetric.display || `${metrics?.failRecall}%`}
          </div>
          <div className="text-[11px] text-slate-400">
            AI catches {metrics?.failRecall}% of all real human-identified QA failures
          </div>
        </div>

        {/* Evidence Accuracy */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Evidence Accuracy</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {metrics?.evidenceAccuracyMetric.display || `${metrics?.evidenceAccuracyRate}%`}
          </div>
          <div className="text-[11px] text-slate-400">
            Human audit of cited transcript utterances ({metrics?.evidenceAccuracyBreakdown.correct} correct, {metrics?.evidenceAccuracyBreakdown.partiallyCorrect} partial)
          </div>
        </div>
      </div>

      {/* PARAMETER-LEVEL CALIBRATION BREAKDOWN WITH SAMPLE BALANCE (Section 10, 20) */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Parameter Agreement & Error Breakdown</h2>
            <p className="text-[11px] text-slate-400">
              Evaluates individual QA criteria to identify where prompt tuning or SOP clarification is required. Every metric shows its exact fraction denominator.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {metrics?.totalGoldAudits || 0} Calls • {metrics?.totalAuditableCriteriaEvaluated || 0} Total Decisions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Scorecard Parameter</th>
                <th className="px-4 py-3">Sample Balance</th>
                <th className="px-4 py-3">Agreement Rate</th>
                <th className="px-4 py-3">False FAIL Rate</th>
                <th className="px-4 py-3">False PASS Rate</th>
                <th className="px-4 py-3">Failure Reason Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {metrics?.parameterAgreement.map((p) => (
                <tr key={p.parameterId} className="hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3.5 font-sans font-medium text-white">
                    {p.parameterName}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                    <span className="text-emerald-400 font-semibold">{p.passCount} PASS</span> •{" "}
                    <span className="text-rose-400 font-semibold">{p.failCount} FAIL</span>
                    {p.partialCount > 0 ? ` • ${p.partialCount} PARTIAL` : ""}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-bold text-cyan-400">{p.agreementFraction.display}</span>
                  </td>
                  <td className="px-4 py-3.5 text-amber-400">
                    {p.falseFailFraction.display}
                  </td>
                  <td className="px-4 py-3.5 text-rose-400">
                    {p.falsePassFraction.display}
                  </td>
                  <td className="px-4 py-3.5 text-indigo-300">
                    {p.failureReasonFraction.display}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FALSE-POSITIVE / FALSE-FAIL ANALYSIS (Section 14, 15, 16) */}
      <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">False-Positive Analysis & Prompt Calibration</h2>
          </div>
          <span className="text-[10px] font-mono text-amber-400">
            {metrics?.falsePositiveAnalysis.length || 0} False FAIL Cases Identified
          </span>
        </div>

        {metrics?.falsePositiveAnalysis.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-xs">
            No false-fail discrepancies detected in active dataset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Call Ref</th>
                  <th className="px-4 py-3">Parameter</th>
                  <th className="px-4 py-3">AI Finding</th>
                  <th className="px-4 py-3">Human Override Reason</th>
                  <th className="px-4 py-3">Root Cause Analysis</th>
                  <th className="px-4 py-3">Recommended SOP / Prompt Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-sans">
                {metrics?.falsePositiveAnalysis.map((f, i) => (
                  <tr key={i} className="hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3.5 font-mono text-white font-medium">
                      {f.externalCallId}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-200">
                      {f.parameterName}
                    </td>
                    <td className="px-4 py-3.5 text-rose-400 font-mono text-[11px]">
                      {f.aiFailureReason || "FAIL"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-950 text-indigo-300 border border-slate-800 mr-1.5">
                        {f.overrideCategory}
                      </span>
                      {f.humanExplanation}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-[11px] max-w-xs">
                      {f.rootCauseAnalysis}
                    </td>
                    <td className="px-4 py-3.5 text-emerald-300 text-[11px] font-medium max-w-xs">
                      {f.recommendedAction}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TWO COLUMN SECTION: Confidence Calibration & Human-Human Agreement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Human-Human Baseline Agreement (Section 11 & 12) */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Human-Human Agreement Baseline</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Measures consistency between independent human QA auditors on double-reviewed calls.
              </p>
            </div>
            <span className="text-[10px] font-mono text-cyan-400">
              {metrics?.humanHumanAgreement?.doubleReviewedCount || 0} Calls Double-Reviewed
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Overall Human-Human Agreement</div>
              <div className="text-xl font-mono font-black text-cyan-400">
                {metrics?.humanHumanAgreement?.overallAgreement.display || "N/A"}
              </div>
              <div className="text-[11px] text-slate-400">
                When human auditors agree at 100%, AI-human disagreement of 93.3% indicates prompt tuning is needed rather than human ambiguity.
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400">Failure Reason Human Consistency</div>
              <div className="text-xl font-mono font-black text-emerald-400">
                {metrics?.humanHumanAgreement?.failureReasonAgreement.display || "N/A"}
              </div>
              <div className="text-[11px] text-slate-400">
                Auditors agree on exact failure categorization in confirmed failure cases.
              </div>
            </div>
          </div>
        </div>

        {/* Model Observability & Cost Analysis */}
        <div className="p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white">Model Cost & Latency Observability</h2>
            <p className="text-[11px] text-slate-400">
              Tokens, API latency, and billable cost estimates for AI auditing.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>Total Tokens</span>
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {metrics?.totalTokensUsed?.toLocaleString() || 0}
              </div>
              <div className="text-[10px] text-slate-500">Across all evaluated calls</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                <span>Estimated Cost</span>
              </div>
              <div className="text-xl font-mono font-bold text-emerald-400">
                ${metrics?.estimatedCostUsd || "0.00"}
              </div>
              <div className="text-[10px] text-slate-500">Blended provider rates</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-indigo-400" />
                <span>Average Latency</span>
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {(metrics?.averageLatencyMs ? metrics.averageLatencyMs / 1000 : 2.1).toFixed(2)}s
              </div>
              <div className="text-[10px] text-slate-500">Per audited call</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" />
                <span>Data Retention</span>
              </div>
              <div className="text-sm font-mono font-bold text-purple-300">
                store: false
              </div>
              <div className="text-[10px] text-slate-500">OpenAI response storage disabled using store:false</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-200">Safety Rule (Section 13): </strong>
            Because FAIL precision is currently 60%, AI-generated FAILs cannot be auto-finalized and require human review. AI recommendation is set to <code className="text-rose-300">REVIEW_FAILURE</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
