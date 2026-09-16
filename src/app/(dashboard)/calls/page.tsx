"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  UploadCloud,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  Loader2,
  Calendar,
  Clock,
} from "lucide-react";
import { CallRecord, CallProcessingStatus } from "@/types/scorecard";

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    async function loadCalls() {
      try {
        setLoading(true);
        const res = await fetch("/api/calls");
        const data = await res.json();
        if (res.ok && data.success) {
          setCalls(data.calls || []);
        }
      } catch (err) {
        console.error("Failed to load calls:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCalls();
  }, []);

  const filteredCalls = calls.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.processing_status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      c.jira_transaction_number?.toLowerCase().includes(q) ||
      c.agent_name?.toLowerCase().includes(q) ||
      c.customer_phone_masked?.toLowerCase().includes(q) ||
      c.issue_type.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: CallProcessingStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
            COMPLETED
          </span>
        );
      case "REVIEW_REQUIRED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
            REVIEW_REQUIRED
          </span>
        );
      case "AUDITING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 animate-pulse">
            AUDITING
          </span>
        );
      case "TRANSCRIBED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
            TRANSCRIBED
          </span>
        );
      case "TRANSCRIBING":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
            TRANSCRIBING
          </span>
        );
      case "UPLOADED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
            UPLOADED
          </span>
        );
      case "UPLOADING":
      case "PENDING_UPLOAD":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse">
            {status}
          </span>
        );
      case "FAILED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
            FAILED
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Call Audits Directory</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Ingested recordings stored in private bucket with privacy masking and signed playback.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/calls/new"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New Call</span>
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search JIRA, agent, phone, or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="UPLOADED">UPLOADED</option>
            <option value="TRANSCRIBING">TRANSCRIBING</option>
            <option value="TRANSCRIBED">TRANSCRIBED</option>
            <option value="AUDITING">AUDITING</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="FAILED">FAILED</option>
            <option value="UPLOADING">UPLOADING</option>
            <option value="PENDING_UPLOAD">PENDING_UPLOAD</option>
          </select>
        </div>
      </div>

      {/* Calls Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="flex items-center justify-center py-16 space-x-2 text-xs text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span>Loading ingested calls...</span>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <PhoneCall className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No calls found matching filter</div>
            <Link
              href="/calls/new"
              className="inline-flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <span>Upload a new recording now</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">JIRA Ref</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Customer (Masked)</th>
                  <th className="px-4 py-3">Interaction Date</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scorecard</th>
                  <th className="px-4 py-3">Audit Score</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCalls.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-cyan-300">
                      {c.jira_transaction_number || "NO JIRA"}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{c.agent_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {c.customer_phone_masked || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {c.interaction_date} {c.interaction_time}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s` : "--"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(c.processing_status)}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-[150px]">
                      {c.scorecard_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      --
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/calls/${c.id}`}
                        className="inline-flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-semibold"
                      >
                        <span>View</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
