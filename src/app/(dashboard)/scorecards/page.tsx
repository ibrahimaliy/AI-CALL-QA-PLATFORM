"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  BookOpen,
  HelpCircle,
  Calculator,
  Volume2,
  FileCode,
  Database,
  Sliders,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Mic,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { INITIAL_SCORECARD, INITIAL_AGENT, INITIAL_ORGANIZATION, INITIAL_CAMPAIGN } from "@/lib/seed-data";
import { AuditSource } from "@/types/scorecard";
import { calculateScorecardResult } from "@/services/scoring/calculator";

export default function ScorecardsPage() {
  const scorecard = INITIAL_SCORECARD;
  const [activeTab, setActiveTab] = useState<"parameters" | "failures" | "verbiage" | "simulator">("parameters");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedParams, setExpandedParams] = useState<Record<string, boolean>>({
    [scorecard.parameters[0].id]: true,
    [scorecard.parameters[1].id]: true,
  });

  // Calculate section stats
  const sectionStats = useMemo(() => {
    const stats: Record<string, { count: number; weight: number }> = {};
    scorecard.parameters.forEach((p) => {
      if (!stats[p.section_name]) {
        stats[p.section_name] = { count: 0, weight: 0 };
      }
      stats[p.section_name].count += 1;
      stats[p.section_name].weight += p.max_weight;
    });
    return stats;
  }, [scorecard]);

  // Filtered parameters
  const filteredParameters = useMemo(() => {
    return scorecard.parameters.filter((param) => {
      const matchesSection = selectedSection === "ALL" || param.section_name === selectedSection;
      const matchesQuery =
        param.parameter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        param.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        param.rules?.some((r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSection && matchesQuery;
    });
  }, [scorecard, selectedSection, searchQuery]);

  // All failure reasons flat list
  const allFailureReasons = useMemo(() => {
    return scorecard.parameters.flatMap((param) =>
      (param.failure_reasons || []).map((fr) => ({
        ...fr,
        parameter_name: param.parameter_name,
        section_name: param.section_name,
      }))
    );
  }, [scorecard]);

  // Filtered failure reasons
  const filteredFailureReasons = useMemo(() => {
    return allFailureReasons.filter((fr) => {
      const q = searchQuery.toLowerCase();
      return (
        fr.code.toLowerCase().includes(q) ||
        fr.label.toLowerCase().includes(q) ||
        (fr.description && fr.description.toLowerCase().includes(q)) ||
        fr.parameter_name.toLowerCase().includes(q)
      );
    });
  }, [allFailureReasons, searchQuery]);

  const toggleParam = (id: string) => {
    setExpandedParams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSourceBadge = (source: AuditSource) => {
    switch (source) {
      case "TRANSCRIPT":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
            <FileText className="w-3 h-3 text-cyan-400" />
            <span>TRANSCRIPT</span>
          </span>
        );
      case "AUDIO":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/60">
            <Mic className="w-3 h-3 text-indigo-400" />
            <span>AUDIO</span>
          </span>
        );
      case "HYBRID":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60">
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>HYBRID (Call + KB)</span>
          </span>
        );
      case "CRM":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>CRM SYSTEM</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">
            <span>{source}</span>
          </span>
        );
    }
  };

  // State for interactive simulator (Demonstrating Section 24 & 31)
  const [simEvaluatedParams, setSimEvaluatedParams] = useState<Record<string, { status: "PASS" | "PARTIAL" | "FAIL" | "REVIEW_REQUIRED"; score: number }>>({
    "e0000000-0000-0000-0000-000000000001": { status: "PASS", score: 4 }, // Greeting (4/4)
    "e0000000-0000-0000-0000-000000000002": { status: "PASS", score: 10 }, // Security (10/10)
    "e0000000-0000-0000-0000-000000000003": { status: "PARTIAL", score: 8 }, // Politeness (8/10)
    "e0000000-0000-0000-0000-000000000004": { status: "PARTIAL", score: 7 }, // Enthusiasm (7/8)
    "e0000000-0000-0000-0000-000000000005": { status: "PARTIAL", score: 7 }, // Comm (7/10)
    "e0000000-0000-0000-0000-000000000006": { status: "PARTIAL", score: 7 }, // Listening (7/8)
    "e0000000-0000-0000-0000-000000000007": { status: "PARTIAL", score: 12 }, // Probing (12/15)
    "e0000000-0000-0000-0000-000000000008": { status: "REVIEW_REQUIRED", score: 0 }, // Accurate Res (Requires KB)
    "e0000000-0000-0000-0000-000000000009": { status: "PARTIAL", score: 10 }, // Completeness (10/11)
    "e0000000-0000-0000-0000-000000000010": { status: "REVIEW_REQUIRED", score: 0 }, // CRM (Requires JIRA)
  });

  const simResult = useMemo(() => {
    const inputs = scorecard.parameters.map((p) => {
      const sim = simEvaluatedParams[p.id] || { status: "REVIEW_REQUIRED", score: 0 };
      return {
        parameterId: p.id,
        maxWeight: p.max_weight,
        awardedPoints: sim.score,
        result: sim.status,
        auditSource: p.audit_source,
        requiresHumanReview: sim.status === "REVIEW_REQUIRED",
      };
    });
    return calculateScorecardResult(inputs, scorecard.passing_score, 100);
  }, [scorecard, simEvaluatedParams]);

  return (
    <div className="space-y-8">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Published Scorecard</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                Version {scorecard.version}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                Passing Score: {scorecard.passing_score}%
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {scorecard.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              {scorecard.description}. Initial source of truth normalized from official QA workbook with 10 parameters, 34 failure reasons, and strict auditable weight tracking.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div>
                <span className="text-slate-500">Organization:</span>{" "}
                <span className="text-slate-200 font-medium">{INITIAL_ORGANIZATION.name}</span>
              </div>
              <span>•</span>
              <div>
                <span className="text-slate-500">Campaign:</span>{" "}
                <span className="text-cyan-300 font-medium">{INITIAL_CAMPAIGN.name}</span>
              </div>
              <span>•</span>
              <div>
                <span className="text-slate-500">Reference Agent:</span>{" "}
                <span className="text-slate-200 font-medium">{INITIAL_AGENT.name} ({INITIAL_AGENT.employee_code})</span>
              </div>
            </div>
          </div>

          {/* KPI Mini-Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Total Scorable Weight</div>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-0.5">100.00</div>
              <div className="text-[10px] text-emerald-400 font-medium flex items-center justify-center space-x-1 mt-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>100% Balanced</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Parameters Count</div>
              <div className="text-2xl font-black text-indigo-400 font-mono mt-0.5">{scorecard.parameters.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">5 Core Sections</div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xs text-slate-400">Failure Reasons</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-0.5">{allFailureReasons.length}</div>
              <div className="text-[10px] text-slate-400 mt-1">Categorized Codes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section Weights Distribution Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(sectionStats).map(([section, data], idx) => (
          <button
            key={section}
            onClick={() => {
              setSelectedSection(selectedSection === section ? "ALL" : section);
              setActiveTab("parameters");
            }}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              selectedSection === section
                ? "bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-500/10"
                : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="truncate pr-1">Section {idx + 1}</span>
              <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">
                {data.weight} pts
              </span>
            </div>
            <div className="font-semibold text-slate-200 text-sm truncate">{section}</div>
            <div className="text-[11px] text-slate-400 mt-1">{data.count} parameters</div>
          </button>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("parameters")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "parameters"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Parameters & Evaluation Rules ({filteredParameters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("failures")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "failures"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Failure Reasons Legend ({allFailureReasons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("verbiage")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "verbiage"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Verbiage Guidelines & SOPs ({scorecard.verbiage_guidelines.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "simulator"
              ? "border-cyan-400 text-cyan-300"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>Deterministic Scoring Engine Simulator</span>
        </button>
      </div>

      {/* Tab 1: Parameters & Rules Inspector */}
      {activeTab === "parameters" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search parameter, rule, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400">Filter Section:</span>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Sections (5)</option>
                {Object.keys(sectionStats).map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} ({sectionStats[sec].weight} pts)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Parameters Accordion List */}
          <div className="space-y-3">
            {filteredParameters.map((param) => {
              const isExpanded = expandedParams[param.id];
              return (
                <div
                  key={param.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden transition-all duration-200 hover:border-slate-700"
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleParam(param.id)}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none bg-slate-900/40 hover:bg-slate-800/40"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-cyan-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {param.section_name}
                          </span>
                          {getSourceBadge(param.audit_source)}
                          {param.is_critical && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950/80 text-red-300 border border-red-800/60">
                              CRITICAL PARAMETER
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                          <span>{param.parameter_name}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                          {param.description}
                        </p>
                      </div>
                    </div>

                    {/* Weight Badge */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/80">
                      <div className="text-xs text-slate-400 sm:hidden">Max Weight:</div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-2xl font-extrabold font-mono text-cyan-400">
                          {param.max_weight}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">pts</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(param.rules || []).length} verifiable rules
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content: Rules & Failure Reasons */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-[#080d19]/80 space-y-5">
                      {/* Rules Breakdown */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center space-x-1.5">
                          <FileCode className="w-4 h-4" />
                          <span>Evaluation Checks & Point Allocations</span>
                        </h4>
                        <div className="space-y-2">
                          {param.rules?.map((rule, rIdx) => (
                            <div
                              key={rule.id}
                              className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start space-x-2.5">
                                <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {rIdx + 1}
                                </span>
                                <div>
                                  <div className="text-xs font-semibold text-slate-200">
                                    {rule.title}
                                  </div>
                                  {rule.description && (
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      {rule.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                                  {rule.rule_type}
                                </span>
                                {rule.allocated_points !== undefined && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                                    +{rule.allocated_points} pts
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Associated Failure Reasons */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2.5 flex items-center space-x-1.5">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Possible Failure Deductions (Legend Codes)</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {param.failure_reasons?.map((fr) => (
                            <div
                              key={fr.id}
                              className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-start space-x-2.5"
                            >
                              <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                              <div>
                                <div className="text-xs font-mono font-semibold text-amber-300">
                                  {fr.code}
                                </div>
                                <div className="text-xs font-medium text-slate-200 mt-0.5">
                                  {fr.label}
                                </div>
                                {fr.description && (
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {fr.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Failure Reasons Legend */}
      {activeTab === "failures" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by code, label, or parameter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="text-xs text-slate-400">
              Showing <span className="font-semibold text-white">{filteredFailureReasons.length}</span> of {allFailureReasons.length} reasons
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Code</th>
                    <th className="px-4 py-3.5">Original Workbook Label</th>
                    <th className="px-4 py-3.5">Parameter Association</th>
                    <th className="px-4 py-3.5">Section</th>
                    <th className="px-4 py-3.5">Audit Definition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredFailureReasons.map((fr) => (
                    <tr key={fr.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                        {fr.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {fr.label}
                      </td>
                      <td className="px-4 py-3 text-cyan-300 whitespace-nowrap">
                        {fr.parameter_name}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {fr.section_name}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs">
                        {fr.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Verbiage Guidelines & SOPs */}
      {activeTab === "verbiage" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/50 text-xs text-cyan-200">
            <strong>Section 29/30 Rule:</strong> The AI evaluates standard/suggestive verbiage according to semantic compliance. A suggested script does not necessarily require verbatim word-for-word matching when equivalent professional wording is used.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scorecard.verbiage_guidelines.map((vb) => (
              <div
                key={vb.id}
                className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                      {vb.parameter}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Language: {vb.language}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Approved Script / Verbiage:
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-200 leading-relaxed italic">
                      &quot;{vb.suggested_verbiage}&quot;
                    </div>
                  </div>
                </div>

                {vb.reference_guideline && (
                  <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
                    <strong className="text-slate-300">Guideline:</strong> {vb.reference_guideline}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Deterministic Scoring Simulator */}
      {activeTab === "simulator" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-800/40">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Calculator className="w-5 h-5 text-indigo-400" />
              <span>Section 24 Specification Compliance: Auditable Weight vs Final Score</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-4xl">
              Per Section 24: &quot;The system must never pretend it evaluated criteria for which it had insufficient information.&quot; 
              If the AI has evidence for 76 points and awards 65, the UI displays <strong>85.5% provisional performance</strong>. It does NOT report 65/100 because the remaining 24 points (accurate resolution / CRM data) require external verification.
            </p>
          </div>

          {/* Real-time Calculation Result Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400">Auditable Weight Evaluated</div>
              <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">
                {simResult.auditableWeight} / {simResult.totalPossibleScore} pts
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {simResult.unAuditedWeight} pts pending external review
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400">Awarded Points</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                {simResult.auditedScore} pts
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                From evaluated parameters
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400">Provisional AI Score</div>
              <div className="text-2xl font-extrabold text-indigo-300 font-mono mt-1">
                {simResult.provisionalPercentage}%
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {simResult.auditedScore} / {simResult.auditableWeight} * 100
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs text-slate-400">Compliance Status</div>
              <div className="text-2xl font-extrabold font-mono mt-1">
                {simResult.isPassed ? (
                  <span className="text-emerald-400">PASS (≥71%)</span>
                ) : (
                  <span className="text-red-400">FAIL (&lt;71%)</span>
                )}
              </div>
              <div className="text-[11px] text-amber-400 mt-1">
                {simResult.requiresHumanReview ? "Human Review Required" : "Audit Complete"}
              </div>
            </div>
          </div>

          {/* Interactive Parameter Scoring Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h4 className="text-sm font-bold text-white">Adjust Parameter Inputs:</h4>
            <div className="space-y-3">
              {scorecard.parameters.map((param) => {
                const current = simEvaluatedParams[param.id] || { status: "PASS", score: param.max_weight };
                return (
                  <div
                    key={param.id}
                    className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="min-w-[260px]">
                      <div className="text-xs font-semibold text-slate-200">{param.parameter_name}</div>
                      <div className="text-[11px] text-slate-400">{param.section_name} • Max: {param.max_weight} pts</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={current.status}
                        onChange={(e) => {
                          const val = e.target.value as "PASS" | "PARTIAL" | "FAIL" | "REVIEW_REQUIRED";
                          let defaultScore = current.score;
                          if (val === "PASS") defaultScore = param.max_weight;
                          if (val === "FAIL" || val === "REVIEW_REQUIRED") defaultScore = 0;
                          setSimEvaluatedParams((prev) => ({
                            ...prev,
                            [param.id]: { status: val, score: defaultScore },
                          }));
                        }}
                        className="bg-slate-900 border border-slate-700 text-xs rounded px-2.5 py-1 text-slate-200"
                      >
                        <option value="PASS">PASS</option>
                        <option value="PARTIAL">PARTIAL</option>
                        <option value="FAIL">FAIL</option>
                        <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                      </select>

                      {current.status !== "REVIEW_REQUIRED" && (
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">Awarded:</span>
                          <input
                            type="number"
                            min="0"
                            max={param.max_weight}
                            step="0.5"
                            value={current.score}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSimEvaluatedParams((prev) => ({
                                ...prev,
                                [param.id]: { ...current, score: Math.min(param.max_weight, Math.max(0, val)) },
                              }));
                            }}
                            className="w-16 bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-cyan-300 font-mono text-right"
                          />
                          <span className="text-xs text-slate-500">/ {param.max_weight}</span>
                        </div>
                      )}

                      {current.status === "REVIEW_REQUIRED" && (
                        <span className="text-xs text-amber-400 italic">
                          (Excluded from auditable weight until external data is supplied)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
