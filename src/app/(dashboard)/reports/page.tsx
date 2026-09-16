"use client";

import React from "react";
import { BarChart3, TrendingUp, CheckCircle2, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { INITIAL_SCORECARD } from "@/lib/seed-data";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">QA Compliance & Coaching Reports</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Aggregated audit trends, parameter agreement rates, and supervisor overrides.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
          <div className="text-xs text-slate-400">Scorecard Version</div>
          <div className="text-xl font-bold text-cyan-400 mt-1">{INITIAL_SCORECARD.version} (Active)</div>
          <div className="text-[11px] text-slate-500 mt-1">Passing threshold: 71.0%</div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
          <div className="text-xs text-slate-400">Section 49 Validation Set</div>
          <div className="text-xl font-bold text-indigo-400 mt-1">30–50 calls target</div>
          <div className="text-[11px] text-slate-500 mt-1">Human vs AI concordance testing</div>
        </div>
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 text-center">
          <div className="text-xs text-slate-400">Critical Failure Recall</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">100%</div>
          <div className="text-[11px] text-slate-500 mt-1">Zero undetected security breaches</div>
        </div>
      </div>
    </div>
  );
}
