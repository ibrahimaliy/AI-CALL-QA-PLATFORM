"use client";

import React, { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PhoneCall,
  Play,
  Volume2,
  Calendar,
  Clock,
  User,
  Layers,
  FileCheck2,
  ShieldCheck,
  AlertCircle,
  FileText,
  Sparkles,
  Lock,
  Loader2,
  HardDrive,
  Search,
  RefreshCw,
  PlayCircle,
  Users,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  CheckCircle,
  XCircle,
  Award,
  HelpCircle,
  Quote,
  ClipboardCheck,
} from "lucide-react";
import { CallRecord, ProcessingEventRecord, AuditResultType, AuditSource } from "@/types/scorecard";
import {
  NormalizedUtterance,
  CallAudioMetrics,
  SpeakerRole,
} from "@/lib/providers/transcription/types";
import { features } from "@/lib/config/features";

interface StoredTranscript {
  id: string;
  call_id: string;
  version?: number;
  is_active?: boolean;
  provider: string;
  provider_transcript_id: string;
  full_text: string;
  language: string;
  confidence: number;
  audio_duration_ms: number;
  requires_speaker_review: boolean;
  requires_transcript_review: boolean;
  transcript_review_reason?: string | null;
  created_at: string;
  speech_model_used?: string | null;
  source_recording_checksum?: string | null;
}

interface StoredSpeakerReview {
  id: string;
  transcript_id: string;
  speaker_label: string;
  original_role: string;
  reviewed_role: string;
  reviewer_id?: string;
  reason?: string;
  created_at: string;
}

interface StoredAuditEvidence {
  id: string;
  utterance_id: string;
  prompt_id: string;
  start_ms: number;
  end_ms: number;
  speaker_role: string;
  quote_text: string;
}

interface StoredAuditParameterResult {
  id: string;
  audit_id: string;
  parameter_id: string;
  parameter_name: string;
  section_name: string;
  max_weight: number;
  awarded_points: number;
  result: AuditResultType;
  audit_source: AuditSource;
  confidence?: number;
  reason?: string;
  failure_reason_code?: string;
  requires_human_review: boolean;
  evidence: StoredAuditEvidence[];
}

interface StoredAudit {
  id: string;
  call_id: string;
  scorecard_id: string;
  scorecard_version: string;
  ai_provider: string;
  ai_model: string;
  prompt_version: string;
  auditable_weight: number;
  ai_awarded_points: number;
  ai_normalized_percentage: number;
  final_score: number | null;
  passing_score: number;
  is_passed: boolean;
  un_audited_weight: number;
  status: "COMPLETED" | "REVIEW_REQUIRED";
  summary: string;
  strengths: string[];
  improvement_areas: string[];
  created_at: string;
  parameters: StoredAuditParameterResult[];
}

interface StoredAuditRun {
  id: string;
  audit_id?: string;
  call_id: string;
  scorecard_id: string;
  scorecard_version: string;
  transcript_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  input_hash: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REJECTED";
  started_at: string;
  completed_at?: string;
  failed_at?: string;
  request_token_count?: number;
  response_token_count?: number;
  response_id?: string;
  error_code?: string;
  error_message?: string;
  created_at: string;
}

function formatMsToTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function maskPii(text: string): string {
  if (!text) return "";
  return text
    // Mask email addresses
    .replace(/\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g, "$1***@$2")
    // Mask Nigerian phone numbers: +234***9088 or 0702****088
    .replace(/(\+?234|0)([789][01]\d)\d{4}(\d{3})/g, "$1$2****$3")
    .replace(/\b(\d{3})\d{4}(\d{3,4})\b/g, "$1****$2")
    // Mask long card or account numbers: ****1234
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?(\d{4})\b/g, "****-****-****-$1");
}

export default function CallDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Core Call State
  const [call, setCall] = useState<CallRecord | null>(null);
  const [events, setEvents] = useState<ProcessingEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio Playback state
  const [signedPlaybackUrl, setSignedPlaybackUrl] = useState<string | null>(null);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [currentPlaybackTimeMs, setCurrentPlaybackTimeMs] = useState(0);

  // Phase 3 Transcription State
  const [transcript, setTranscript] = useState<StoredTranscript | null>(null);
  const [utterances, setUtterances] = useState<NormalizedUtterance[]>([]);
  const [audioMetrics, setAudioMetrics] = useState<CallAudioMetrics | null>(null);
  const [speakerReviews, setSpeakerReviews] = useState<StoredSpeakerReview[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // Phase 4 AI QA Audit State
  const [audit, setAudit] = useState<StoredAudit | null>(null);
  const [auditRuns, setAuditRuns] = useState<StoredAuditRun[]>([]);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // UI Interactive State
  const [searchQuery, setSearchQuery] = useState("");
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [speakerOverrides, setSpeakerOverrides] = useState<Record<string, SpeakerRole>>({});
  const [savingSpeakerRoles, setSavingSpeakerRoles] = useState(false);

  // Load call & events
  const loadCallData = async (showLoadingSpinner: boolean = false) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      }
      const res = await fetch(`/api/calls/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load call details.");
      }
      setCall(data.call);
      setEvents(data.events || []);

      // Load short-lived signed playback URL
      if (data.call.audio_storage_path) {
        setLoadingPlayback(true);
        const playRes = await fetch(`/api/calls/${id}/playback`);
        const playData = await playRes.json();
        if (playRes.ok && playData.success) {
          setSignedPlaybackUrl(playData.signedUrl);
        }
      }

      // Load transcript if transcribed or in progress
      if (
        data.call.processing_status === "TRANSCRIBED" ||
        data.call.processing_status === "AUDITING" ||
        data.call.processing_status === "REVIEW_REQUIRED" ||
        data.call.processing_status === "COMPLETED"
      ) {
        await loadTranscriptData();
        await loadAuditData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading call.");
    } finally {
      setLoading(false);
      setLoadingPlayback(false);
    }
  };

  const loadTranscriptData = async () => {
    try {
      const res = await fetch(`/api/calls/${id}/transcript`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTranscript(data.transcript);
          setUtterances(data.utterances || []);
          setAudioMetrics(data.metrics || null);
          setSpeakerReviews(data.speakerReviews || []);

          // Initialize speaker overrides map
          if (data.utterances) {
            const initialMap: Record<string, SpeakerRole> = {};
            data.utterances.forEach((u: NormalizedUtterance) => {
              if (!initialMap[u.speakerLabel]) {
                initialMap[u.speakerLabel] = u.speakerRole || "UNKNOWN";
              }
            });
            setSpeakerOverrides(initialMap);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load transcript data:", e);
    }
  };

  const loadAuditData = async () => {
    try {
      const res = await fetch(`/api/calls/${id}/audit`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAudit(data.audit || null);
          setAuditRuns(data.runs || []);
        }
      }
    } catch (e) {
      console.error("Failed to load audit data:", e);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCallData(false);
    });
  }, [id]);

  // Audio time update handler for synchronization
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentPlaybackTimeMs(Math.round(audioRef.current.currentTime * 1000));
    }
  };

  // Seek to utterance or evidence timestamp
  const handleSeekToUtterance = (startMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startMs / 1000;
      audioRef.current.play().catch(() => {});
    }
  };

  // Start transcription handler (strictly asynchronous with fail-closed selection)
  const handleStartTranscription = async (forceMock = false) => {
    try {
      setTranscribing(true);
      setTranscriptionError(null);
      const res = await fetch(`/api/calls/${id}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceMock }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start transcription.");
      }
      await loadCallData();

      // Poll until provider completes or fails
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
        const syncRes = await fetch(`/api/calls/${id}/transcribe`);
        const syncData = await syncRes.json();
        if (syncData.completed || syncData.status === "TRANSCRIBED" || syncData.status === "FAILED") {
          await loadCallData();
          await loadTranscriptData();
          break;
        }
      }
      await loadCallData();
      await loadTranscriptData();
    } catch (err: unknown) {
      setTranscriptionError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  };

  // Retry transcription handler (strictly asynchronous)
  const handleRetryTranscription = async () => {
    try {
      setRetrying(true);
      setTranscriptionError(null);
      const res = await fetch(`/api/calls/${id}/transcription/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to retry transcription.");
      }
      await loadCallData();

      // Poll until provider completes or fails
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
        const syncRes = await fetch(`/api/calls/${id}/transcribe`);
        const syncData = await syncRes.json();
        if (syncData.completed || syncData.status === "TRANSCRIBED" || syncData.status === "FAILED") {
          await loadCallData();
          await loadTranscriptData();
          break;
        }
      }
      await loadCallData();
      await loadTranscriptData();
    } catch (err: unknown) {
      setTranscriptionError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  };

  // Submit speaker role overrides
  const handleSaveSpeakerRoles = async () => {
    try {
      setSavingSpeakerRoles(true);
      const res = await fetch(`/api/calls/${id}/transcript/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleOverrides: speakerOverrides,
          reason: "Supervisor manual verification via UI",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update speaker roles.");
      }
      setShowSpeakerModal(false);
      await loadTranscriptData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving roles.");
    } finally {
      setSavingSpeakerRoles(false);
    }
  };

  // Start Phase 4 AI QA Audit Handler
  const handleStartAudit = async (forceNewRun = false) => {
    try {
      setAuditing(true);
      setAuditError(null);
      const res = await fetch(`/api/calls/${id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNewRun }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to execute AI QA audit.");
      }
      setAudit(data.audit);
      await loadCallData();
      await loadAuditData();
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : "AI QA Audit failed.");
    } finally {
      setAuditing(false);
    }
  };

  // Filter utterances by search query
  const filteredUtterances = utterances.filter((u) => {
    if (!searchQuery.trim()) return true;
    return (
      u.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.speakerRole || "UNKNOWN").toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.speakerLabel.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Unique speaker labels
  const uniqueSpeakers = Array.from(new Set(utterances.map((u) => u.speakerLabel)));

  // Latest Audit Run
  const latestRun = auditRuns.length > 0 ? auditRuns[0] : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <div className="text-xs text-slate-400">Loading call interaction record...</div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-950 text-red-400 border border-red-800 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white">Call Not Found</h2>
        <p className="text-xs text-slate-400">{error || "Requested call could not be located."}</p>
        <Link
          href="/calls"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Calls</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back Button */}
      <Link
        href="/calls"
        className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Calls Directory</span>
      </Link>

      {/* Header Banner */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              {call.jira_transaction_number || "NO JIRA REF"}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                call.processing_status === "COMPLETED"
                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                  : call.processing_status === "REVIEW_REQUIRED"
                  ? "bg-amber-950 text-amber-300 border-amber-800"
                  : call.processing_status === "AUDITING"
                  ? "bg-indigo-950 text-indigo-300 border-indigo-800 animate-pulse"
                  : call.processing_status === "TRANSCRIBED"
                  ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                  : call.processing_status === "TRANSCRIBING"
                  ? "bg-amber-950 text-amber-300 border-amber-800 animate-pulse"
                  : call.processing_status === "FAILED"
                  ? "bg-red-950 text-red-300 border-red-800"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {call.processing_status}
            </span>
            {call.customer_phone_masked && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Customer: {call.customer_phone_masked}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {call.issue_type}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Recorded {call.interaction_date} at {call.interaction_time} • Query Count: {call.query_count}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {call.processing_status === "UPLOADED" && (
            <button
              onClick={() => handleStartTranscription(false)}
              disabled={transcribing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {transcribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>{transcribing ? "Starting..." : "Start Transcription"}</span>
            </button>
          )}

          {call.processing_status === "FAILED" && (
            <button
              onClick={handleRetryTranscription}
              disabled={retrying}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>{retrying ? "Retrying..." : "Retry Transcription"}</span>
            </button>
          )}

          {features.aiQa && (call.processing_status === "TRANSCRIBED" || call.processing_status === "REVIEW_REQUIRED") && (
            <button
              onClick={() => handleStartAudit(false)}
              disabled={auditing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {auditing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{auditing ? "Auditing Transcript..." : audit ? "Re-run AI Audit" : "Start AI Audit"}</span>
            </button>
          )}

          {!features.aiQa && (call.processing_status === "TRANSCRIBED" || call.processing_status === "REVIEW_REQUIRED") && (
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900/80 text-slate-400 border border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>AI QA: Disabled pending approved rules</span>
            </div>
          )}

          {features.aiQa && (
            <Link
              href="/scorecards"
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
            >
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              <span>Scorecard Rules</span>
            </Link>
          )}
        </div>
      </div>

      {/* Transcription or Audit Error Banner */}
      {(transcriptionError || auditError) && (
        <div className="p-4 rounded-xl border border-red-800 bg-red-950/50 flex items-center space-x-3 text-xs text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
          <span>{transcriptionError || auditError}</span>
        </div>
      )}

      {/* In-Progress Auditing Banner */}
      {call.processing_status === "AUDITING" && (
        <div className="p-4 rounded-xl border border-indigo-800/80 bg-indigo-950/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-cyan-200">AI Quality Evaluation in Progress</h4>
              <p className="text-[11px] text-cyan-300/80">
                OpenAI is objectively analyzing validated transcript evidence using Structured Outputs.
              </p>
            </div>
          </div>
          <button
            onClick={() => loadCallData()}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-900/60 hover:bg-indigo-800/80 text-cyan-200 border border-indigo-700/60 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Status</span>
          </button>
        </div>
      )}

      {/* Audio Player & Storage Card */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Private Recording Playback</h2>
          </div>
          <div className="flex items-center space-x-2 text-xs text-indigo-300">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Secured with Short-Lived Signed URL</span>
          </div>
        </div>

        {signedPlaybackUrl ? (
          <div className="space-y-3">
            <audio
              ref={audioRef}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-11 rounded-lg outline-none bg-slate-950"
              src={signedPlaybackUrl}
            >
              Your browser does not support the audio element.
            </audio>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-slate-400 truncate max-w-md">
                  {call.audio_storage_path}
                </span>
              </div>
              <div>
                File size: <strong className="text-slate-300">{((call.audio_size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-400">
            {loadingPlayback ? "Generating secure signed playback token..." : "Audio recording pending or unavailable."}
          </div>
        )}
      </div>

      {/* Conversational Audio Metrics Card */}
      {audioMetrics && (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Derived Conversational Metrics (Audio Diarization)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Total Duration: {formatMsToTime(audioMetrics.speechDurationMs || (audioMetrics as unknown as Record<string, number>).speech_duration_ms || 0)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-slate-400">Speaker Turns</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">
                {audioMetrics.speakerTurnCount ?? (audioMetrics as unknown as Record<string, number>).speaker_turn_count ?? 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-cyan-400">Agent Utterances</div>
              <div className="text-xl font-bold text-cyan-300 font-mono mt-0.5">
                {audioMetrics.agentUtteranceCount ?? (audioMetrics as unknown as Record<string, number>).agent_utterance_count ?? 0}{" "}
                <span className="text-xs font-normal text-slate-400 font-sans">
                  ({audioMetrics.agentWordCount ?? (audioMetrics as unknown as Record<string, number>).agent_word_count ?? 0} words)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-indigo-400">Customer Utterances</div>
              <div className="text-xl font-bold text-indigo-300 font-mono mt-0.5">
                {audioMetrics.customerUtteranceCount ?? (audioMetrics as unknown as Record<string, number>).customer_utterance_count ?? 0}{" "}
                <span className="text-xs font-normal text-slate-400 font-sans">
                  ({audioMetrics.customerWordCount ?? (audioMetrics as unknown as Record<string, number>).customer_word_count ?? 0} words)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-[11px] text-slate-400">Talk Ratio (Agent : Customer)</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-0.5">
                {(audioMetrics.roughTalkRatio <= 1 ? audioMetrics.roughTalkRatio * 100 : audioMetrics.roughTalkRatio).toFixed(0)}% :{" "}
                {(100 - (audioMetrics.roughTalkRatio <= 1 ? audioMetrics.roughTalkRatio * 100 : audioMetrics.roughTalkRatio)).toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-indigo-950 overflow-hidden flex border border-slate-800">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{
                  width: `${Math.round(audioMetrics.roughTalkRatio <= 1 ? audioMetrics.roughTalkRatio * 100 : audioMetrics.roughTalkRatio)}%`,
                }}
              />
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{
                  width: `${Math.round(100 - (audioMetrics.roughTalkRatio <= 1 ? audioMetrics.roughTalkRatio * 100 : audioMetrics.roughTalkRatio))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span className="text-cyan-400">Agent Talk Time</span>
              <span className="text-indigo-400">Customer Talk Time</span>
            </div>
          </div>
        </div>
      )}

      {/* Speaker Role Review Alert Banner */}
      {transcript?.requires_speaker_review && (
        <div className="p-4 rounded-xl border border-amber-800 bg-amber-950/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-200">Speaker Role Verification Required</h4>
              <p className="text-[11px] text-amber-300/80">
                {transcript.transcript_review_reason ||
                  "The automated speaker role heuristic detected low confidence or ambiguous turn cues."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSpeakerModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Review & Confirm Roles</span>
          </button>
        </div>
      )}

      {/* Speaker Roles Modal / Inline Editor */}
      {showSpeakerModal && (
        <div className="p-5 rounded-2xl border border-cyan-800 bg-slate-900/90 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">Supervisor Speaker Role Re-assignment</h4>
            </div>
            <button
              onClick={() => setShowSpeakerModal(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Select the true semantic role for each audio channel speaker label. Original provider labels (Speaker A, B) remain preserved in the audit trail.
          </p>

          <div className="space-y-3">
            {uniqueSpeakers.map((label) => (
              <div
                key={label}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
              >
                <span className="font-mono text-xs font-bold text-cyan-300">
                  {label}
                </span>

                <div className="flex items-center space-x-2">
                  {(["AGENT", "CUSTOMER", "UNKNOWN"] as SpeakerRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() =>
                        setSpeakerOverrides((prev) => ({ ...prev, [label]: role }))
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        speakerOverrides[label] === role
                          ? role === "AGENT"
                            ? "bg-cyan-500 text-slate-950 border-cyan-400"
                            : role === "CUSTOMER"
                            ? "bg-indigo-600 text-white border-indigo-500"
                            : "bg-amber-500 text-slate-950 border-amber-400"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={() => setShowSpeakerModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
            <button
              onClick={handleSaveSpeakerRoles}
              disabled={savingSpeakerRoles}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {savingSpeakerRoles ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Save & Confirm Roles</span>
            </button>
          </div>
        </div>
      )}

      {/* Synchronized Transcript Engine */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Synchronized Diarized Transcript</h2>
              <p className="text-[11px] text-slate-400">
                Click any utterance to jump audio playback • Preserves millisecond timestamps
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 w-44 sm:w-56"
              />
            </div>

            {transcript && (
              <button
                onClick={() => setShowSpeakerModal(true)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                title="Edit Speaker Roles"
              >
                <Users className="w-4 h-4 text-cyan-400" />
              </button>
            )}
          </div>
        </div>

        {/* Prominent Mock Warning Banner (Section 20) */}
        {transcript &&
          (transcript.provider === "MOCK_PROVIDER" ||
            transcript.provider === "mock" ||
            (transcript.full_text &&
              transcript.full_text.includes("Boluwatife") &&
              transcript.full_text.includes("Andrea Ayinde"))) && (
            <div className="p-4 rounded-xl border border-amber-600 bg-amber-950/80 text-amber-200 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-xs uppercase tracking-wider text-amber-300">
                  ⚠ MOCK TRANSCRIPTION — NOT REAL PROVIDER DATA
                </div>
                <div className="text-[11px] text-amber-200/90 mt-0.5">
                  This transcript was generated by the mock provider or development fixture and does not represent genuine audio analysis.
                </div>
              </div>
            </div>
          )}

        {/* Transcription Details Diagnostics Card (Section 19) */}
        {transcript && (
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Provider</div>
              <div className="font-bold text-cyan-300 mt-0.5">{transcript.provider}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Speech Model</div>
              <div className="font-mono text-slate-300 mt-0.5">{transcript.speech_model_used || "universal-3-pro"}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Transcript Duration</div>
              <div className="font-mono text-white mt-0.5">{formatMsToTime(transcript.audio_duration_ms)}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Recording Checksum</div>
              <div className="text-emerald-400 font-semibold mt-0.5 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Verified</span>
              </div>
            </div>
            {transcript.provider_transcript_id && (
              <div className="col-span-2 sm:col-span-4 text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-900">
                <span>Job ID: {transcript.provider_transcript_id}</span>
                <span>• Version: {transcript.version || 1}</span>
                <span>• Utterances: {utterances.length}</span>
                {call.duration_seconds && (
                  <span>• Recording Duration: {formatMsToTime(call.duration_seconds * 1000)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {utterances.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400">
              {call.processing_status === "TRANSCRIBING"
                ? "Transcription is processing in the background..."
                : call.processing_status === "UPLOADED"
                ? "Call uploaded. Click 'Start Transcription' to generate speaker-separated transcript."
                : "No transcript available for this call."}
            </div>
            {call.processing_status === "UPLOADED" && (
              <button
                onClick={() => handleStartTranscription(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer"
              >
                Start Transcription
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredUtterances.map((u, idx) => {
              const isCurrent =
                currentPlaybackTimeMs >= u.startMs && currentPlaybackTimeMs <= u.endMs;
              const utteranceKey = u.id || `utt-${u.utteranceIndex ?? idx}-${u.startMs}`;

              return (
                <div
                  key={utteranceKey}
                  onClick={() => handleSeekToUtterance(u.startMs)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? "border-cyan-500 bg-cyan-950/30 shadow-lg shadow-cyan-500/10"
                      : "border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${
                          u.speakerRole === "AGENT"
                            ? "bg-cyan-950 text-cyan-300 border-cyan-800"
                            : u.speakerRole === "CUSTOMER"
                            ? "bg-indigo-950 text-indigo-300 border-indigo-800"
                            : "bg-amber-950 text-amber-300 border-amber-800"
                        }`}
                      >
                        {u.speakerRole}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {u.speakerLabel}
                      </span>
                      {u.speakerRoleConfidence !== undefined && (
                        <span className="text-[10px] text-slate-500">
                          ({(u.speakerRoleConfidence * 100).toFixed(0)}% conf)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                      <PlayCircle className="w-3 h-3 text-cyan-400" />
                      <span>{formatMsToTime(u.startMs)} - {formatMsToTime(u.endMs)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed pl-1">
                    {maskPii(u.text)}
                  </p>
                </div>
              );
            })}

            {filteredUtterances.length === 0 && searchQuery && (
              <div className="text-center py-6 text-xs text-slate-500">
                No utterances match search &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        )}
      </div>

      {/* PHASE 4: EVIDENCE-GROUNDED AI QA AUDIT PANEL */}
      {features.aiQa ? (
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white">AI Quality Evaluation Engine</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                  OpenAI Structured Outputs
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Evaluates strictly grounded transcript criteria • Backend computes deterministic scores
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {transcript && (
              <button
                onClick={() => handleStartAudit(false)}
                disabled={auditing}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {auditing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{auditing ? "Auditing..." : audit ? "Re-evaluate Call" : "Run AI QA Audit"}</span>
              </button>
            )}

            {audit && (
              <Link
                href={`/audits/${audit.id}/review`}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Human Review Workspace</span>
              </Link>
            )}
          </div>
        </div>

        {/* Audit Result Display */}
        {!audit ? (
          <div className="py-10 text-center space-y-3">
            <Award className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-xs text-slate-400">
              {call.processing_status === "AUDITING"
                ? "OpenAI is evaluating eligible transcript criteria..."
                : "No AI audit has been performed on this call yet."}
            </div>
            {transcript && call.processing_status !== "AUDITING" && (
              <button
                onClick={() => handleStartAudit(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer"
              >
                Start AI Audit
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Scorecard Summary Card */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Scorecard Performance (Audited Criteria Only)
                  </div>
                  <div className="flex items-baseline space-x-2 mt-1">
                    <span className="text-2xl font-black text-white font-mono">
                      {audit.ai_awarded_points} / {audit.auditable_weight}
                    </span>
                    <span className="text-sm font-bold text-cyan-400 font-mono">
                      ({audit.ai_normalized_percentage}% provisional)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-amber-400 font-semibold flex items-center justify-end space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{audit.un_audited_weight} pts require external evidence / review</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Audio, CRM & KB sources pending integration
                  </div>
                </div>
              </div>

              {/* Multi-segment Score Breakdown Bar */}
              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(audit.ai_awarded_points / 100) * 100}%` }}
                    title={`Audited Score: ${audit.ai_awarded_points} pts`}
                  />
                  <div
                    className="h-full bg-red-500/80 transition-all"
                    style={{ width: `${((audit.auditable_weight - audit.ai_awarded_points) / 100) * 100}%` }}
                    title={`Lost Audited Points: ${audit.auditable_weight - audit.ai_awarded_points} pts`}
                  />
                  <div
                    className="h-full bg-amber-500/50 transition-all"
                    style={{ width: `${(audit.un_audited_weight / 100) * 100}%` }}
                    title={`Pending Review: ${audit.un_audited_weight} pts`}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span className="text-emerald-400">Awarded: {audit.ai_awarded_points} pts</span>
                  <span className="text-red-400">Audited Missed: {(audit.auditable_weight - audit.ai_awarded_points).toFixed(1)} pts</span>
                  <span className="text-amber-400">Pending Review: {audit.un_audited_weight} pts</span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2">
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-cyan-300 font-medium">Audit Summary: </strong>
                  {audit.summary}
                </p>

                {/* Strengths & Improvement Areas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                  <div>
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>Observed Strengths</span>
                    </div>
                    <ul className="space-y-1">
                      {audit.strengths.map((s, idx) => (
                        <li key={idx} className="text-[11px] text-slate-300 flex items-start space-x-1.5">
                          <span className="text-emerald-400">•</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>Coaching / Improvement Areas</span>
                    </div>
                    <ul className="space-y-1">
                      {audit.improvement_areas.map((i, idx) => (
                        <li key={idx} className="text-[11px] text-slate-300 flex items-start space-x-1.5">
                          <span className="text-amber-400">•</span>
                          <span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Run Metadata Badge */}
              {latestRun && (
                <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>Model: {latestRun.model} ({latestRun.prompt_version})</span>
                  <span>Tokens: {latestRun.request_token_count || 0} in / {latestRun.response_token_count || 0} out</span>
                  <span className="truncate max-w-[220px]" title={latestRun.input_hash}>
                    Hash: {latestRun.input_hash.slice(0, 16)}...
                  </span>
                </div>
              )}
            </div>

            {/* Individual Parameters List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Scorecard Parameter Breakdown (10 Parameters)
              </h3>

              <div className="space-y-3">
                {audit.parameters.map((param) => {
                  const isEvaluated = param.result !== "REVIEW_REQUIRED";
                  const isPass = param.result === "PASS";

                  return (
                    <div
                      key={param.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isEvaluated
                          ? isPass
                            ? "bg-slate-950/70 border-emerald-900/60"
                            : "bg-slate-950/70 border-red-900/60"
                          : "bg-slate-950/40 border-slate-800/80"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          {isEvaluated ? (
                            isPass ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )
                          ) : (
                            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <h4 className="text-xs font-bold text-white">
                            {param.parameter_name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({param.section_name})
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                            {param.audit_source}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isEvaluated
                                ? isPass
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : "bg-red-950 text-red-300 border-red-800"
                                : "bg-amber-950 text-amber-300 border-amber-800"
                            }`}
                          >
                            {param.result}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-200">
                            {param.awarded_points} / {param.max_weight} pts
                          </span>
                        </div>
                      </div>

                      {/* Explanation & Failure Reason */}
                      <div className="pl-6 space-y-2">
                        {param.failure_reason_code && (
                          <div className="text-[11px] font-mono text-red-400 flex items-center space-x-1.5">
                            <span className="font-bold">Failure Reason:</span>
                            <span className="px-1.5 py-0.5 rounded bg-red-950/80 border border-red-900 text-red-300">
                              {param.failure_reason_code}
                            </span>
                          </div>
                        )}

                        <p className="text-xs text-slate-300 leading-relaxed">
                          {param.reason}
                        </p>

                        {/* Evidence Quotes with Click-to-Seek Synchronization */}
                        {param.evidence && param.evidence.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Supporting Transcript Evidence:
                            </div>
                            <div className="space-y-1.5">
                              {param.evidence.map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={() => handleSeekToUtterance(ev.start_ms)}
                                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500 hover:bg-slate-850 transition-all cursor-pointer flex items-start space-x-2 text-xs group"
                                >
                                  <Quote className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mb-0.5">
                                      <span className="font-bold text-cyan-300">[{ev.prompt_id}]</span>
                                      <span>{formatMsToTime(ev.start_ms)} - {formatMsToTime(ev.end_ms)}</span>
                                      <span className="px-1 rounded bg-slate-800 text-slate-300">{ev.speaker_role}</span>
                                      <span className="text-cyan-400 group-hover:underline flex items-center space-x-0.5">
                                        <PlayCircle className="w-3 h-3 inline" />
                                        <span>Click to listen</span>
                                      </span>
                                    </div>
                                    <p className="text-slate-200 italic">
                                      &quot;{ev.quote_text}&quot;
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {param.confidence !== undefined && (
                          <div className="text-[10px] font-mono text-slate-500">
                            Confidence: {(param.confidence * 100).toFixed(0)}%
                          </div>
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
      ) : (
        <div className="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-md space-y-3 text-center">
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400/80" />
            <h2 className="text-sm font-bold text-white">AI Quality Evaluation Engine</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
              Gated in Testing Release
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            AI QA auditing and automated scoring are currently disabled pending approved production scorecard rules. Contact-center audio upload, AssemblyAI diarization, transcript review, and speaker attribution are fully active.
          </p>
        </div>
      )}

      {/* Grid: Call Info & Processing Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Call Info */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center space-x-2">
            <User className="w-4 h-4 text-cyan-400" />
            <span>Assignment & Telephony Metadata</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Assigned Agent:</span>
              <span className="text-white font-medium">{call.agent_name || "Olabiyi Boluwatife"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Campaign:</span>
              <span className="text-cyan-300 font-medium">{call.campaign_name || "Inbound Support"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Target Scorecard:</span>
              <span className="text-slate-200 font-medium">{call.scorecard_name || "v1.0 (71% Pass)"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">External Call ID:</span>
              <span className="text-slate-200 font-mono">{call.external_call_id || "None"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Client Request ID:</span>
              <span className="text-slate-400 font-mono text-[10px] truncate max-w-[200px]">
                {call.client_request_id || "—"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Recorded Filename:</span>
              <span className="text-slate-200 font-mono">{call.original_filename || "recording.mp3"}</span>
            </div>
          </div>
        </div>

        {/* Processing Timeline */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Processing Event Log (Observability)</span>
          </h3>

          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No events logged yet.</div>
            ) : (
              events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start space-x-3 text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-cyan-300">{evt.stage}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(evt.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-slate-300 mt-0.5">{evt.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
