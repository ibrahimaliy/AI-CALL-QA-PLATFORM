"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  User,
  ShieldCheck,
  Calendar,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { StoredAuditReview, ReviewStatus, ReviewPriority } from "@/types/review";

export default function ReviewsQueuePage() {
  const [reviews, setReviews] = useState<StoredAuditReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [assignedToMe, setAssignedToMe] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadReviews = async (showLoadingSpinner: boolean = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (assignedToMe) params.append("assignedToMe", "true");

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || []);
      }
    } catch (e) {
      console.error("Failed to load reviews:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadReviews(false);
    });
  }, [statusFilter, priorityFilter, assignedToMe]);

  const filteredReviews = reviews.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.call_id.toLowerCase().includes(q) ||
      (r.reviewer_name && r.reviewer_name.toLowerCase().includes(q))
    );
  });

  const getPriorityBadge = (priority: ReviewPriority) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-red-950/80 text-red-300 border-red-800";
      case "HIGH":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "NORMAL":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800";
      case "LOW":
        return "bg-slate-900 text-slate-400 border-slate-700";
    }
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case "FINALIZED":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800";
      case "APPROVED":
        return "bg-teal-950/80 text-teal-300 border-teal-800";
      case "SUBMITTED":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-800";
      case "IN_REVIEW":
        return "bg-blue-950/80 text-blue-300 border-blue-800";
      case "ASSIGNED":
        return "bg-amber-950/80 text-amber-300 border-amber-800";
      case "REOPENED":
        return "bg-rose-950/80 text-rose-300 border-rose-800";
      default:
        return "bg-slate-900 text-slate-400 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <ClipboardCheck className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Human QA Review Queue
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
              Phase 5A
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative human review workspace • Inspect AI findings, complete manual criteria, and calibrate accuracy
          </p>
        </div>

        <button
          onClick={() => {
            void loadReviews(true);
          }}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
            {["ALL", "UNASSIGNED", "ASSIGNED", "IN_REVIEW", "SUBMITTED", "FINALIZED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-cyan-500 text-slate-950 font-semibold shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search call ID or reviewer..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-slate-800/60">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-cyan-500/60"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={assignedToMe}
              onChange={(e) => setAssignedToMe(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <span>Assigned to me only</span>
          </label>

          <div className="ml-auto text-[11px] text-slate-500 font-mono">
            Showing {filteredReviews.length} reviews
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3">Call ID / Interaction</th>
                <th className="px-4 py-3">AI Provisional %</th>
                <th className="px-4 py-3">AI Coverage</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Human Final Score</th>
                <th className="px-4 py-3">Assigned Reviewer</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading review queue...
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No reviews found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((r) => {
                  const reviewedCount = r.decisions.filter(
                    (d) => d.human_result !== "REVIEW_REQUIRED" && d.human_result
                  ).length;

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-mono text-white font-medium">
                          {r.call_id.slice(0, 14)}...
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono">
                        <span className="text-cyan-400 font-bold">
                          {((r.original_ai_score / 30) * 100).toFixed(0)}%
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {r.original_ai_score} / 30 pts
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">
                        <span className="text-slate-300 font-semibold">30%</span>
                        <div className="text-[10px] text-slate-500">30 / 100 pts</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${getPriorityBadge(
                            r.priority
                          )}`}
                        >
                          {r.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${getStatusBadge(
                            r.status
                          )}`}
                        >
                          {r.status}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {reviewedCount} / 10 resolved
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {r.final_score !== null && r.final_score !== undefined ? (
                          <div className="flex items-center space-x-1.5 font-mono">
                            <span
                              className={`font-bold ${
                                r.is_passed ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {r.final_score} / 100
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded border font-sans font-bold ${
                                r.is_passed
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : "bg-red-950 text-red-300 border-red-800"
                              }`}
                            >
                              {r.is_passed ? "PASS" : "FAIL"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 font-mono">
                            {r.reviewed_score ? `${r.reviewed_score} pts (Draft)` : "Pending review"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {r.reviewer_name ? (
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <User className="w-3 h-3 text-cyan-400" />
                            <span>{r.reviewer_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/audits/${r.audit_id}/review`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 shadow-md shadow-cyan-500/10 transition cursor-pointer"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
