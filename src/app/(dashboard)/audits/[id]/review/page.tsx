"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Save,
  Send,
  Check,
  ShieldCheck,
  Award,
  Layers,
  FileText,
  AlertTriangle,
  Users,
  Search,
  ExternalLink,
  Lock,
} from "lucide-react";
import {
  StoredAuditReview,
  StoredAuditResultOverride,
  ParameterDecisionInput,
  OverrideReasonCategory,
  AIEvidenceAccuracy,
} from "@/types/review";
import { StoredAudit } from "@/services/auditing/audit.service";
import { CallRecord } from "@/types/scorecard";
import { NormalizedUtterance } from "@/lib/providers/transcription/types";

export default function AuditReviewWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Review & Call state
  const [review, setReview] = useState<StoredAuditReview | null>(null);
  const [audit, setAudit] = useState<StoredAudit | null>(null);
  const [call, setCall] = useState<CallRecord | null>(null);
  const [utterances, setUtterances] = useState<NormalizedUtterance[]>([]);
  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);

  // Editable decisions map: parameter_id -> decision
  const [decisions, setDecisions] = useState<Record<string, ParameterDecisionInput>>({});
  const [overallComment, setOverallComment] = useState("");
  const [activeParamId, setActiveParamId] = useState<string | null>(null);
  const [overrideEditorOpen, setOverrideEditorOpen] = useState<Record<string, boolean>>({});

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const loadWorkspaceData = async (showLoadingSpinner: boolean = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      setError(null);
      setConflictError(null);

      const res = await fetch(`/api/reviews/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load review workspace.");
      }

      setReview(data.review);
      setAudit(data.audit);
      setCall(data.call);
      setUtterances(data.utterances || []);
      setSignedAudioUrl(data.signedAudioUrl);
      setOverallComment(data.review.comment || "");

      // Initialize decisions map
      const initialMap: Record<string, ParameterDecisionInput> = {};
      const overrideState: Record<string, boolean> = {};

      data.review.decisions.forEach((d: StoredAuditResultOverride) => {
        initialMap[d.parameter_id] = {
          parameter_id: d.parameter_id,
          review_action: d.review_action,
          human_result: d.human_result,
          human_awarded_points: d.human_awarded_points,
          human_failure_reason: d.human_failure_reason,
          override_reason_category: d.override_reason_category,
          override_notes: d.override_notes,
          ai_evidence_accuracy: d.ai_evidence_accuracy || "CORRECT",
          human_evidence_utterance_ids: d.human_evidence_utterance_ids || [],
          evaluation_source: d.evaluation_source,
          crm_checked: d.crm_checked,
          jira_checked: d.jira_checked,
        };
        overrideState[d.parameter_id] = d.review_action === "OVERRIDDEN";
      });

      setDecisions(initialMap);
      setOverrideEditorOpen(overrideState);
      if (data.review.decisions.length > 0) {
        setActiveParamId(data.review.decisions[0].parameter_id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading review.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadWorkspaceData(false);
    });
  }, [id]);

  // Autosave handler (debounced)
  const saveDraft = async (manual: boolean = false) => {
    if (!review) return;
    try {
      setSaving(true);
      setConflictError(null);

      const payload = {
        expectedVersion: review.version,
        decisions: Object.values(decisions),
        comment: overallComment,
      };

      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 409) {
        setConflictError(data.error);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save draft.");
      }

      setReview(data.review);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      console.error("Autosave error:", err);
      if (manual) setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // One-click Agreement (Section 15)
  const handleAgreeWithAI = (paramId: string) => {
    const aiParam = audit?.parameters.find((p) => p.parameter_id === paramId);
    if (!aiParam) return;

    setDecisions((prev) => ({
      ...prev,
      [paramId]: {
        ...prev[paramId],
        review_action: "AGREED",
        human_result: aiParam.result,
        human_awarded_points: aiParam.awarded_points,
        human_failure_reason: aiParam.failure_reason_code,
        override_reason_category: undefined,
        override_notes: undefined,
        ai_evidence_accuracy: "CORRECT",
      },
    }));

    setOverrideEditorOpen((prev) => ({ ...prev, [paramId]: false }));
  };

  // Toggle Override mode (Section 16)
  const handleToggleOverride = (paramId: string, maxWeight: number) => {
    const current = decisions[paramId];
    const willOverride = !overrideEditorOpen[paramId];
    setOverrideEditorOpen((prev) => ({ ...prev, [paramId]: willOverride }));

    if (willOverride) {
      setDecisions((prev) => ({
        ...prev,
        [paramId]: {
          ...prev[paramId],
          review_action: "OVERRIDDEN",
          human_result: current?.human_result === "PASS" ? "FAIL" : "PASS",
          human_awarded_points: current?.human_result === "PASS" ? 0 : maxWeight,
          override_reason_category: "QA_RULE_INTERPRETATION",
        },
      }));
    }
  };

  // Attach utterance as human evidence (Section 18)
  const handleAttachEvidence = (utteranceId: string) => {
    if (!activeParamId) return;
    setDecisions((prev) => {
      const current = prev[activeParamId] || {};
      const list = current.human_evidence_utterance_ids || [];
      if (list.includes(utteranceId)) return prev;
      return {
        ...prev,
        [activeParamId]: {
          ...current,
          human_evidence_utterance_ids: [...list, utteranceId],
        },
      };
    });
  };

  // Audio player helpers
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (ms: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = ms / 1000;
    setCurrentTimeMs(ms);
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleRateChange = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  // Lifecycle transitions
  const handleFinalize = async () => {
    if (!review) return;
    if (!confirm("Are you sure you want to finalize this QA review? This produces the official QA score and records calibration data.")) return;

    try {
      setSaving(true);
      // First save current decisions
      await saveDraft(false);

      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to finalize review.");
      }

      setReview(data.review);
      alert(`Audit finalized successfully! Final score: ${data.review.final_score}/100.0 (${data.review.is_passed ? "PASS" : "FAIL"}).`);
      router.push("/reviews");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error finalizing review.");
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!review) return;
    const reason = prompt("Enter mandatory reason for reopening this finalized review:");
    if (!reason) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen", reopenReason: reason }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);

      setReview(data.review);
      alert("Review reopened.");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to reopen.");
    } finally {
      setSaving(false);
    }
  };

  // Real-time calculation of human score
  const humanScoreTotal = Object.values(decisions).reduce(
    (sum, d) => sum + (d.human_awarded_points || 0),
    0
  );

  const resolvedCount = Object.values(decisions).filter(
    (d) => d.human_result !== "REVIEW_REQUIRED" && d.human_result
  ).length;

  const filteredUtterances = utterances.filter((u) =>
    searchQuery ? u.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Clock className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <div className="text-sm text-slate-400">Loading Human QA Review Workspace...</div>
      </div>
    );
  }

  if (error || !review || !audit) {
    return (
      <div className="p-8 max-w-xl mx-auto rounded-2xl border border-red-900 bg-red-950/40 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
        <div className="text-sm text-red-200">{error || "Review record not found."}</div>
        <Link href="/reviews" className="inline-block px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-200">
          Back to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 409 Conflict Banner */}
      {conflictError && (
        <div className="p-4 rounded-xl border border-amber-800 bg-amber-950/80 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{conflictError}</span>
          </div>
          <button
            onClick={() => {
              void loadWorkspaceData(true);
            }}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold cursor-pointer"
          >
            Reload Latest Version
          </button>
        </div>
      )}

      {/* Workspace Header & Action Bar */}
      <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/reviews"
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Back to Review Queue"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white font-mono">
                {call?.original_filename || `Call ${call?.id.slice(0, 8)}`}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-800">
                {review.status}
              </span>
              <span className="text-[10px] font-mono text-slate-500">v{review.version}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Agent: <strong className="text-slate-200">{call?.agent_name}</strong> • Issue: {call?.issue_type}
            </div>
          </div>
        </div>

        {/* Score & Progress Summary */}
        <div className="flex items-center space-x-6 text-xs">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Human Reviewed Score</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-black font-mono text-white">{humanScoreTotal.toFixed(1)}</span>
              <span className="text-slate-400 font-mono">/ 100.0</span>
            </div>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <div className="text-[10px] uppercase font-bold text-slate-400">AI Provisional Performance</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5 font-mono">
              <span className="text-sm font-bold text-cyan-400">
                {((audit.ai_awarded_points / 30) * 100).toFixed(0)}%
              </span>
              <span className="text-[11px] text-slate-400">({audit.ai_awarded_points} / 30 pts)</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 ml-1">
                30% Coverage
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Resolution Progress</div>
            <div className="flex items-baseline space-x-1 mt-0.5 font-mono font-bold">
              <span className={resolvedCount === 10 ? "text-emerald-400" : "text-amber-400"}>
                {resolvedCount} / 10
              </span>
              <span className="text-slate-400 font-normal">resolved</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 border-l border-slate-800 pl-4">
            <button
              onClick={() => saveDraft(true)}
              disabled={saving}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Draft"}</span>
            </button>

            {review.status === "FINALIZED" ? (
              <button
                onClick={handleReopen}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 cursor-pointer"
              >
                Reopen Review
              </button>
            ) : (
              <button
                onClick={handleFinalize}
                disabled={resolvedCount < 10 || saving}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={resolvedCount < 10 ? "All 10 parameters must be resolved to finalize" : "Finalize audit"}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Finalize QA Score</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DUAL-PANE WORKSPACE: LEFT = Audio & Transcript, RIGHT = Scorecard Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Audio Player & Synchronized Transcript (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Audio Player Card */}
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recording Playback</span>
              </span>
              <button
                onClick={handleRateChange}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-cyan-300 border border-slate-800 cursor-pointer"
              >
                {playbackRate}x
              </button>
            </div>

            {signedAudioUrl ? (
              <audio
                ref={audioRef}
                src={signedAudioUrl}
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setCurrentTimeMs(audioRef.current.currentTime * 1000);
                  }
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDurationMs(audioRef.current.duration * 1000);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            ) : (
              <div className="text-xs text-amber-400/80 italic">Audio recording path unavailable.</div>
            )}

            {/* Custom Audio Controls */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={durationMs || 100}
                value={currentTimeMs}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{(currentTimeMs / 1000).toFixed(1)}s</span>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleSeek(Math.max(0, currentTimeMs - 5000))}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title="Seek -5s"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <button
                    onClick={() => handleSeek(Math.min(durationMs, currentTimeMs + 5000))}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    title="Seek +5s"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span>{(durationMs / 1000).toFixed(1)}s</span>
              </div>
            </div>
          </div>

          {/* Transcript List Card */}
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Transcript Evidence</span>
              </span>

              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-7 pr-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 w-32 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredUtterances.map((u, i) => {
                const isCurrent = currentTimeMs >= u.startMs && currentTimeMs <= u.endMs;
                const promptId = `U${String(i + 1).padStart(4, "0")}`;
                const utteranceKey = u.id || `utt-${u.utteranceIndex ?? i}-${u.startMs}`;

                return (
                  <div
                    key={utteranceKey}
                    className={`p-3 rounded-xl border text-xs transition ${
                      isCurrent
                        ? "border-cyan-500 bg-cyan-950/30 shadow-md shadow-cyan-500/10"
                        : "border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[10px] text-slate-500">{promptId}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                            u.speakerRole === "AGENT"
                              ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                              : "bg-indigo-950 text-indigo-300 border-indigo-800"
                          }`}
                        >
                          {u.speakerRole}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleSeek(u.startMs)}
                          className="text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer"
                        >
                          {(u.startMs / 1000).toFixed(1)}s
                        </button>
                        <button
                          onClick={() => handleAttachEvidence(u.id || utteranceKey)}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 transition cursor-pointer"
                          title="Attach this utterance as human evidence to the active parameter"
                        >
                          + Evidence
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">{u.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: QA Scorecard Human Review Workspace (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">Scorecard Criteria Review</h2>
                <p className="text-[11px] text-slate-400">
                  Select parameters to inspect AI findings, agree, or override with human rationale.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {lastSaved ? `Draft saved ${lastSaved}` : "Unsaved changes"}
              </div>
            </div>

            {/* Parameter Cards List */}
            <div className="space-y-4">
              {review.decisions.map((dec) => {
                const isAiEvaluated = dec.ai_result !== undefined;
                const isOverridden = overrideEditorOpen[dec.parameter_id];
                const aiParam = audit.parameters.find((p) => p.parameter_id === dec.parameter_id);
                const currentDecision = decisions[dec.parameter_id] || dec;

                return (
                  <div
                    key={dec.parameter_id}
                    onClick={() => setActiveParamId(dec.parameter_id)}
                    className={`p-4 rounded-2xl border transition-all ${
                      activeParamId === dec.parameter_id
                        ? "border-cyan-500/80 bg-slate-950 shadow-lg shadow-cyan-500/5"
                        : "border-slate-800/80 bg-slate-950/60 hover:border-slate-700"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-white">
                          {dec.parameter_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-300 border border-slate-800">
                          {dec.max_weight} pts max
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border ${
                            dec.evaluation_source === "AI_TRANSCRIPT"
                              ? "bg-indigo-950 text-indigo-300 border-indigo-800"
                              : dec.evaluation_source === "HUMAN_AUDIO"
                              ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                              : dec.evaluation_source === "HUMAN_CRM"
                              ? "bg-purple-950 text-purple-300 border-purple-800"
                              : "bg-amber-950 text-amber-300 border-amber-800"
                          }`}
                        >
                          {dec.evaluation_source}
                        </span>
                      </div>

                      {/* Current Human Result Badge */}
                      <div className="flex items-center space-x-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            currentDecision.human_result === "PASS"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : currentDecision.human_result === "FAIL"
                              ? "bg-red-950 text-red-300 border-red-800"
                              : currentDecision.human_result === "PARTIAL"
                              ? "bg-amber-950 text-amber-300 border-amber-800"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}
                        >
                          {currentDecision.human_result} ({currentDecision.human_awarded_points} pts)
                        </span>
                      </div>
                    </div>

                    {/* AI Finding Display (if evaluated by AI) */}
                    {isAiEvaluated ? (
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2 mb-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <strong className="text-indigo-200">AI Finding:</strong>
                            <span
                              className={`font-bold ${
                                dec.ai_result === "PASS" ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {dec.ai_result}
                            </span>
                            {dec.ai_failure_reason && (
                              <span className="text-red-300 font-mono text-[10px]">
                                ({dec.ai_failure_reason})
                              </span>
                            )}
                            {dec.ai_result === "FAIL" && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                                AI_RECOMMENDATION: REVIEW_FAILURE
                              </span>
                            )}
                          </div>

                          {/* AI Evidence Accuracy Selector */}
                          <div className="flex items-center space-x-1 text-[10px]">
                            <span className="text-slate-500">Evidence Accuracy:</span>
                            {(["CORRECT", "PARTIALLY_CORRECT", "INCORRECT"] as AIEvidenceAccuracy[]).map(
                              (acc) => (
                                <button
                                  key={acc}
                                  onClick={() =>
                                    setDecisions((prev) => ({
                                      ...prev,
                                      [dec.parameter_id]: {
                                        ...prev[dec.parameter_id],
                                        ai_evidence_accuracy: acc,
                                      },
                                    }))
                                  }
                                  className={`px-1.5 py-0.5 rounded cursor-pointer ${
                                    currentDecision.ai_evidence_accuracy === acc
                                      ? "bg-cyan-500 text-slate-950 font-bold"
                                      : "bg-slate-950 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  {acc.charAt(0)}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {aiParam?.reason && (
                          <p className="text-slate-300 text-[11px] leading-relaxed">
                            {aiParam.reason}
                          </p>
                        )}

                        {/* Evidence Pills */}
                        {aiParam?.evidence && aiParam.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {aiParam.evidence.map((ev, evIdx) => (
                              <button
                                key={ev.id || `${ev.prompt_id}-${evIdx}`}
                                onClick={() => handleSeek(ev.start_ms)}
                                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-cyan-400 cursor-pointer"
                              >
                                {ev.prompt_id} ({(ev.start_ms / 1000).toFixed(1)}s)
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs mb-3 space-y-1">
                        <div className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>AI Not Evaluated — Manual Human QA Required</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {dec.evaluation_source === "HUMAN_AUDIO"
                            ? "Listen directly to agent tone, vocal composure, and audio pacing."
                            : dec.evaluation_source === "HUMAN_CRM"
                            ? "Verify ticket creation in JIRA and customer account history in CRM."
                            : "Verify security SOP protocol against customer identity details."}
                        </p>
                      </div>
                    )}

                    {/* Review Actions: Agree or Override */}
                    <div className="space-y-3 pt-1">
                      {isAiEvaluated && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAgreeWithAI(dec.parameter_id)}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              currentDecision.review_action === "AGREED"
                                ? "bg-emerald-500 text-slate-950 font-bold shadow"
                                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Agree with AI</span>
                          </button>

                          <button
                            onClick={() => handleToggleOverride(dec.parameter_id, dec.max_weight)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                              isOverridden
                                ? "bg-amber-500 text-slate-950 font-bold shadow"
                                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                            }`}
                          >
                            <span>{isOverridden ? "Cancel Override" : "Override AI"}</span>
                          </button>
                        </div>
                      )}

                      {/* Override Editor or Manual Input Form */}
                      {(isOverridden || !isAiEvaluated) && (
                        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                Human QA Decision
                              </label>
                              <select
                                value={currentDecision.human_result}
                                onChange={(e) => {
                                  const resVal = e.target.value as "PASS" | "FAIL" | "PARTIAL" | "NOT_APPLICABLE";
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [dec.parameter_id]: {
                                      ...prev[dec.parameter_id],
                                      human_result: resVal,
                                      human_awarded_points:
                                        resVal === "PASS"
                                          ? dec.max_weight
                                          : resVal === "FAIL"
                                          ? 0
                                          : dec.max_weight / 2,
                                    },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/60"
                              >
                                <option value="PASS">PASS</option>
                                <option value="PARTIAL">PARTIAL</option>
                                <option value="FAIL">FAIL</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                Awarded Points (Max: {dec.max_weight})
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={dec.max_weight}
                                value={currentDecision.human_awarded_points}
                                onChange={(e) => {
                                  const pts = Number(e.target.value);
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [dec.parameter_id]: {
                                      ...prev[dec.parameter_id],
                                      human_awarded_points: pts,
                                    },
                                  }));
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/60"
                              />
                            </div>
                          </div>

                          {/* Override Category (Section 17) */}
                          {isOverridden && (
                            <div>
                              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                Override Reason Category (Required)
                              </label>
                              <select
                                value={currentDecision.override_reason_category || "OTHER"}
                                onChange={(e) =>
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [dec.parameter_id]: {
                                      ...prev[dec.parameter_id],
                                      override_reason_category: e.target.value as OverrideReasonCategory,
                                    },
                                  }))
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/60"
                              >
                                <option value="AI_MISSED_EVIDENCE">AI Missed Valid Evidence</option>
                                <option value="AI_MISINTERPRETED_EVIDENCE">AI Misinterpreted Evidence</option>
                                <option value="TRANSCRIPT_ERROR">Transcription Error</option>
                                <option value="SPEAKER_MAPPING_ERROR">Speaker Role Mapping Error</option>
                                <option value="QA_RULE_INTERPRETATION">QA Rule / SOP Interpretation</option>
                                <option value="INCORRECT_FAILURE_REASON">Incorrect Failure Reason</option>
                                <option value="INSUFFICIENT_CONTEXT">Insufficient Context</option>
                                <option value="OTHER">Other Reason</option>
                              </select>
                            </div>
                          )}

                          {/* CRM Checkboxes for CRM Parameter */}
                          {dec.evaluation_source === "HUMAN_CRM" && (
                            <div className="flex items-center space-x-6 text-xs text-slate-300 pt-1">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentDecision.crm_checked || false}
                                  onChange={(e) =>
                                    setDecisions((prev) => ({
                                      ...prev,
                                      [dec.parameter_id]: {
                                        ...prev[dec.parameter_id],
                                        crm_checked: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                                />
                                <span>CRM Customer Profile Verified</span>
                              </label>

                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={currentDecision.jira_checked || false}
                                  onChange={(e) =>
                                    setDecisions((prev) => ({
                                      ...prev,
                                      [dec.parameter_id]: {
                                        ...prev[dec.parameter_id],
                                        jira_checked: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded border-slate-700 bg-slate-950 text-cyan-500"
                                />
                                <span>JIRA Ticket Logged & Escalated</span>
                              </label>
                            </div>
                          )}

                          {/* Reviewer Notes */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Reviewer Notes / Justification
                            </label>
                            <textarea
                              rows={2}
                              value={currentDecision.override_notes || ""}
                              onChange={(e) =>
                                setDecisions((prev) => ({
                                  ...prev,
                                  [dec.parameter_id]: {
                                    ...prev[dec.parameter_id],
                                    override_notes: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Provide justification or notes for this parameter score..."
                              className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                            />
                          </div>

                          {/* Attached Human Evidence Utterances */}
                          {currentDecision.human_evidence_utterance_ids &&
                            currentDecision.human_evidence_utterance_ids.length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  Attached Human Evidence ({currentDecision.human_evidence_utterance_ids.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {currentDecision.human_evidence_utterance_ids.map((uId, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[10px] font-mono flex items-center space-x-1"
                                    >
                                      <span>Utterance {uId.slice(0, 8)}</span>
                                      <button
                                        onClick={() =>
                                          setDecisions((prev) => ({
                                            ...prev,
                                            [dec.parameter_id]: {
                                              ...prev[dec.parameter_id],
                                              human_evidence_utterance_ids: prev[
                                                dec.parameter_id
                                              ].human_evidence_utterance_ids?.filter((id) => id !== uId),
                                            },
                                          }))
                                        }
                                        className="text-cyan-400 hover:text-white ml-1 cursor-pointer"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall Reviewer Comment */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Overall QA Reviewer Summary & Coaching Notes
              </label>
              <textarea
                rows={3}
                value={overallComment}
                onChange={(e) => setOverallComment(e.target.value)}
                placeholder="Add high-level QA auditor observations, commendations, or coaching plan..."
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
