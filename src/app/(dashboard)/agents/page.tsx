"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Users, Shield, PhoneCall, TrendingUp, CheckCircle2, UploadCloud, Search } from "lucide-react";
import { SAMPLE_AGENTS, SAMPLE_CAMPAIGNS, INITIAL_ORGANIZATION } from "@/lib/seed-data";

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = SAMPLE_AGENTS.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCampaignName = (campaignId?: string) => {
    const found = SAMPLE_CAMPAIGNS.find((c) => c.id === campaignId);
    return found ? found.name : "Inbound Customer Support";
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Support Team Roster</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Customer Support Agents</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Agent roster linked to campaigns, scorecard evaluations, and coaching insights.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/calls/new"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Call for Agent</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search agents by name, code, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-semibold">{filteredAgents.length}</span> active agents
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgents.map((agent, idx) => {
          const colors = [
            "from-cyan-600 to-indigo-600",
            "from-emerald-600 to-teal-600",
            "from-purple-600 to-indigo-600",
            "from-amber-600 to-orange-600",
            "from-blue-600 to-cyan-600",
          ];
          const colorClass = colors[idx % colors.length];

          return (
            <div
              key={agent.id}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md space-y-4 hover:border-slate-700 transition-all shadow-md"
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-tr ${colorClass} text-white font-bold text-base flex items-center justify-center border border-white/20 shadow-sm`}
                >
                  {getInitials(agent.name)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                  <div className="text-xs font-mono text-cyan-400">{agent.employee_code}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Organization:</span>
                  <span className="text-slate-200 font-medium">{INITIAL_ORGANIZATION.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Campaign:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[180px]">
                    {getCampaignName(agent.campaign_id)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[180px]">
                    {agent.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Active Agent</span>
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">QA Rating:</span>
                <span className="text-sm font-extrabold font-mono text-emerald-400">
                  {(82 + ((idx * 3.7) % 11)).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
