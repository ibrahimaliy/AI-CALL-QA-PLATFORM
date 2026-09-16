"use client";

import React from "react";
import Link from "next/link";
import {
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  FileCheck2,
  Users,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { INITIAL_SCORECARD, INITIAL_AGENT } from "@/lib/seed-data";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-950 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Contact Centre QA Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Supervisor Audit Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Real-time monitoring of customer-service call evaluations against official QA scorecard rules with deterministic scoring.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/scorecards"
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all shadow-md shadow-cyan-500/10"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>View Active Scorecard (v1.0)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Calls Audited</span>
            <PhoneCall className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono mt-2">48</div>
          <div className="text-[11px] text-slate-400 flex items-center space-x-1 mt-1">
            <span className="text-emerald-400 font-medium">100% automated initial audit</span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Average Final QA Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-2">84.6%</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Passing threshold: <span className="text-cyan-300 font-semibold">{INITIAL_SCORECARD.passing_score}%</span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>QA Pass Rate</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-300 font-mono mt-2">89.6%</div>
          <div className="text-[11px] text-slate-400 mt-1">
            43 of 48 calls meeting standard
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Human Review</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono mt-2">3</div>
          <div className="text-[11px] text-amber-300/80 mt-1">
            Requires supervisor confirmation
          </div>
        </div>
      </div>

      {/* Two Column Layout: Top Failure Reasons & Recent Audited Calls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Failure Reasons Breakdown */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Top Failure Deductions</span>
            </h3>
            <span className="text-[11px] text-slate-500">Last 30 days</span>
          </div>

          <div className="space-y-3">
            {[
              { code: "USES_FILLER_WORDS", label: "Repeated use of filler words", count: 12, pct: 25 },
              { code: "MISSED_MYSMILE_PITCH", label: "Did not pitch MySmile App", count: 9, pct: 19 },
              { code: "HOLD_REFRESH_NOT_DONE", label: "Hold refresh timing not respected", count: 6, pct: 13 },
              { code: "INTERRUPTS_CUSTOMER", label: "Customer interruptions / cross-talk", count: 4, pct: 8 },
              { code: "INCOMPLETE_NOTES", label: "CRM ticket notes incomplete", count: 3, pct: 6 },
            ].map((item) => (
              <div key={item.code} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-mono text-slate-200">{item.code}</span>
                  <span className="text-slate-400">{item.count} calls ({item.pct}%)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                    style={{ width: `${item.pct * 3}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 truncate">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Calls Sample Audit List */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Evaluated Interactions</h3>
              <p className="text-xs text-slate-400">Audits calculated with verified 100-point scorecard</p>
            </div>
            <Link
              href="/scorecards"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
            >
              <span>Inspect Rules</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Call Ref / JIRA</th>
                  <th className="px-3 py-2.5">Agent</th>
                  <th className="px-3 py-2.5">Customer Masked</th>
                  <th className="px-3 py-2.5">AI Provisional</th>
                  <th className="px-3 py-2.5">Final QA Score</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {[
                  {
                    jira: "NGCC-2533730",
                    agent: INITIAL_AGENT.name,
                    phone: "*9088",
                    provisional: "85.5%",
                    finalScore: "87.0%",
                    passed: true,
                    review: false,
                  },
                  {
                    jira: "NGCC-2533812",
                    agent: "Adebayo Tunde",
                    phone: "*4120",
                    provisional: "92.0%",
                    finalScore: "94.0%",
                    passed: true,
                    review: false,
                  },
                  {
                    jira: "NGCC-2533904",
                    agent: "Chioma Okonkwo",
                    phone: "*8821",
                    provisional: "64.0%",
                    finalScore: "68.0%",
                    passed: false,
                    review: true,
                  },
                  {
                    jira: "NGCC-2534015",
                    agent: INITIAL_AGENT.name,
                    phone: "*7734",
                    provisional: "78.5%",
                    finalScore: "81.0%",
                    passed: true,
                    review: false,
                  },
                ].map((c) => (
                  <tr key={c.jira} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-3 font-mono font-semibold text-cyan-300">{c.jira}</td>
                    <td className="px-3 py-3 font-medium text-slate-100">{c.agent}</td>
                    <td className="px-3 py-3 font-mono text-slate-400">{c.phone}</td>
                    <td className="px-3 py-3 font-mono text-slate-300">{c.provisional}</td>
                    <td className="px-3 py-3 font-mono font-bold text-white">{c.finalScore}</td>
                    <td className="px-3 py-3">
                      {c.passed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                          PASS
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-800/60">
                          FAIL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
