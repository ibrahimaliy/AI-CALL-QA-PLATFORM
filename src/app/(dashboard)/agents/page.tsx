"use client";

import React from "react";
import { Users, Shield, PhoneCall, TrendingUp, CheckCircle2 } from "lucide-react";
import { INITIAL_AGENT, INITIAL_CAMPAIGN, INITIAL_ORGANIZATION } from "@/lib/seed-data";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Support Agents</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Agent roster linked to campaigns, scorecard evaluations, and coaching insights.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center border border-white/20">
              OP
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{INITIAL_AGENT.name}</h3>
              <div className="text-xs font-mono text-cyan-400">{INITIAL_AGENT.employee_code}</div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Organization:</span>
              <span className="text-slate-200 font-medium">{INITIAL_ORGANIZATION.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Campaign:</span>
              <span className="text-slate-200 font-medium">{INITIAL_CAMPAIGN.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Email:</span>
              <span className="text-slate-200 font-mono">{INITIAL_AGENT.email}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-semibold">Active Agent</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Average QA:</span>
            <span className="text-sm font-extrabold font-mono text-emerald-400">87.0%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
