"use client";

import React, { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Clock,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  INITIAL_AGENT,
  INITIAL_CAMPAIGN,
  INITIAL_SCORECARD,
  INITIAL_ORGANIZATION,
} from "@/lib/seed-data";
import { STORAGE_CONFIG } from "@/lib/storage/config";
import { selectUploadStrategy } from "@/lib/storage/upload-strategy";

type UploadStep =
  | "IDLE"
  | "VALIDATING"
  | "CREATING_CALL"
  | "UPLOADING"
  | "COMPLETING"
  | "SUCCESS"
  | "ERROR";

async function computeFileSha256(file: File): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.crypto?.subtle) {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (err) {
    console.warn("Client-side SHA-256 computation skipped:", err);
  }
  return null;
}

export default function NewCallPage() {
  const router = useRouter();
  const formKeyId = useId();

  // Form Fields
  const [agentId, setAgentId] = useState(INITIAL_AGENT.id);
  const [campaignId, setCampaignId] = useState(INITIAL_CAMPAIGN.id);
  const [scorecardId, setScorecardId] = useState(INITIAL_SCORECARD.id);
  const [interactionDate, setInteractionDate] = useState("2026-09-10");
  const [interactionTime, setInteractionTime] = useState("09:15:00");
  const [jiraTransaction, setJiraTransaction] = useState("NGCC-2533890");
  const [customerPhone, setCustomerPhone] = useState("07020209088");
  const [issueType, setIssueType] = useState("Account & Service Inquiry");
  const [queryCount, setQueryCount] = useState(1);
  const [externalCallId, setExternalCallId] = useState("EXT-991204");
  const [notes, setNotes] = useState("");

  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStep, setUploadStep] = useState<UploadStep>("IDLE");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>("Uploading recording...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCallId, setCreatedCallId] = useState<string | null>(null);

  // Client request ID (Idempotency key per form lifecycle)
  const [clientRequestId, setClientRequestId] = useState(() => `req_${crypto.randomUUID()}`);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      return;
    }

    const file = e.target.files[0];

    // Client validation
    if (file.size > STORAGE_CONFIG.MAX_CALL_UPLOAD_BYTES) {
      setErrorMessage(
        `Selected file exceeds the maximum allowed limit of ${STORAGE_CONFIG.MAX_CALL_UPLOAD_MB} MB.`
      );
      setSelectedFile(null);
      return;
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!STORAGE_CONFIG.ALLOWED_EXTENSIONS.some((e) => e === ext)) {
      setErrorMessage(
        `Unsupported format (${ext}). Allowed formats: ${STORAGE_CONFIG.ALLOWED_EXTENSIONS.join(
          ", "
        )}`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please select a valid audio recording file to upload.");
      return;
    }

    setErrorMessage(null);
    setUploadStep("VALIDATING");

    try {
      // 1. Mask customer phone number per Section 19: e.g. *9088
      const maskedPhone =
        customerPhone.length > 4
          ? `*${customerPhone.slice(-4)}`
          : customerPhone;

      // 2. Request Upload Authorization (POST /api/calls/upload-intent)
      setUploadStep("CREATING_CALL");

      const intentRes = await fetch("/api/calls/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          campaignId,
          scorecardId,
          interactionDate,
          interactionTime,
          jiraTransactionNumber: jiraTransaction,
          customerPhoneMasked: maskedPhone,
          issueType,
          queryCount,
          externalCallId,
          clientRequestId,
          fileName: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || "audio/mpeg",
        }),
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok || !intentData.success) {
        throw new Error(intentData.error || "Failed to initialize call upload.");
      }

      const { call, uploadAuthorization } = intentData;
      setCreatedCallId(call.id);

      // 3. Direct Browser-to-Storage Upload (bypasses Next.js server payload limit)
      // Uses TUS Resumable for files > 6MB, Standard Direct for files <= 6MB
      setUploadStep("UPLOADING");
      setUploadProgress(0);
      setUploadStatusText("Starting direct storage upload...");

      const strategy = selectUploadStrategy(selectedFile.size);
      await strategy.upload(
        selectedFile,
        {
          storagePath: uploadAuthorization.storagePath,
          uploadUrl: uploadAuthorization.uploadUrl,
          uploadHeaders: uploadAuthorization.uploadHeaders,
          resumableEndpoint: uploadAuthorization.resumableEndpoint,
          bucket: uploadAuthorization.bucket,
          supabaseUrl: uploadAuthorization.supabaseUrl,
          supabaseAnonKey: uploadAuthorization.supabaseAnonKey,
        },
        (info) => {
          setUploadProgress(info.percentage);
          setUploadStatusText(`${info.status} recording... ${info.percentage}%`);
        }
      );

      // 4. Confirm Upload Completion (POST /api/calls/[id]/upload-complete)
      setUploadStep("COMPLETING");

      let fileChecksum: string | null = null;
      try {
        fileChecksum = await computeFileSha256(selectedFile);
      } catch {
        fileChecksum = null;
      }

      const completeRes = await fetch(`/api/calls/${call.id}/upload-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: uploadAuthorization.storagePath,
          fileSizeBytes: selectedFile.size,
          recordingChecksum: fileChecksum,
          durationSeconds: null,
        }),
      });

      const completeData = await completeRes.json();
      if (!completeRes.ok || !completeData.success) {
        throw new Error(completeData.error || "Failed to finalize upload verification.");
      }

      // 5. Success -> Redirect to Call Details
      setUploadStep("SUCCESS");
      setTimeout(() => {
        router.push(`/calls/${call.id}`);
      }, 800);
    } catch (err: unknown) {
      setUploadStep("ERROR");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during upload."
      );
      setClientRequestId(`req_${crypto.randomUUID()}`);
    }
  };

  const isSubmitting =
    uploadStep === "VALIDATING" ||
    uploadStep === "CREATING_CALL" ||
    uploadStep === "UPLOADING" ||
    uploadStep === "COMPLETING";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        href="/calls"
        className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Calls Directory</span>
      </Link>

      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phase 2 Secure Ingestion</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Upload Customer Service Call
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Recordings are uploaded directly to private storage and bound to the official QA scorecard.
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center space-x-2">
            <span className="text-slate-400">Organization:</span>
            <span className="font-semibold text-white">{INITIAL_ORGANIZATION.name}</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold">Upload Error:</strong> {errorMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setUploadStep("IDLE");
            }}
            className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800/80 text-red-100 text-xs font-semibold border border-red-700/60 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleUploadSubmit} className="space-y-6">
        {/* Call Metadata Section */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
            1. Interaction & Assignment Context
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Agent */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Support Agent *
              </label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={INITIAL_AGENT.id}>
                  {INITIAL_AGENT.name} ({INITIAL_AGENT.employee_code})
                </option>
              </select>
            </div>

            {/* Campaign */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Campaign / Line of Business *
              </label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={INITIAL_CAMPAIGN.id}>{INITIAL_CAMPAIGN.name}</option>
              </select>
            </div>

            {/* Scorecard */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                QA Scorecard Version *
              </label>
              <select
                value={scorecardId}
                onChange={(e) => setScorecardId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <option value={INITIAL_SCORECARD.id}>
                  {INITIAL_SCORECARD.name} (v{INITIAL_SCORECARD.version}) - {INITIAL_SCORECARD.passing_score}%
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {/* Interaction Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Interaction Date *
              </label>
              <input
                type="date"
                value={interactionDate}
                onChange={(e) => setInteractionDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Interaction Time */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Interaction Time *
              </label>
              <input
                type="time"
                step="1"
                value={interactionTime}
                onChange={(e) => setInteractionTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* JIRA Transaction */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                JIRA Transaction Ref
              </label>
              <input
                type="text"
                placeholder="NGCC-2533730"
                value={jiraTransaction}
                onChange={(e) => setJiraTransaction(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
                <span>Customer Mobile</span>
                <span className="text-[10px] text-cyan-400">Masked in DB</span>
              </label>
              <input
                type="text"
                placeholder="07020209088"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Issue Type (as selected by agent) *
              </label>
              <input
                type="text"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Number of Queries on Call
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={queryCount}
                onChange={(e) => setQueryCount(parseInt(e.target.value) || 1)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                External Call ID (Telephony Ref)
              </label>
              <input
                type="text"
                value={externalCallId}
                onChange={(e) => setExternalCallId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Audio Recording Upload Section */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              2. Audio Recording File
            </h2>
            <span className="text-xs text-slate-400">
              Max file size: <strong className="text-cyan-400">{STORAGE_CONFIG.MAX_CALL_UPLOAD_MB} MB</strong>
            </span>
          </div>

          <div className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-6 text-center transition-all bg-slate-950/40">
            <input
              type="file"
              id="audio-upload-input"
              accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />
            <label
              htmlFor="audio-upload-input"
              className="cursor-pointer flex flex-col items-center space-y-2 select-none"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {selectedFile ? selectedFile.name : "Click to select or drag audio recording"}
              </div>
              <div className="text-xs text-slate-400">
                Supported formats: MP3, WAV, M4A, AAC
              </div>
              {selectedFile && (
                <div className="mt-2 inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-xs text-cyan-300 font-mono">
                  <FileAudio className="w-3.5 h-3.5" />
                  <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Progress & Live State Indicator */}
        {isSubmitting && (
          <div className="p-4 rounded-xl bg-slate-900 border border-cyan-800/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-300 font-medium flex items-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>
                  {uploadStep === "VALIDATING" && "Validating call metadata..."}
                  {uploadStep === "CREATING_CALL" && "Creating call record and authorizing upload..."}
                  {uploadStep === "UPLOADING" && (uploadStatusText || "Uploading audio directly to private storage bucket...")}
                  {uploadStep === "COMPLETING" && "Verifying storage object and finalizing call status..."}
                </span>
              </span>
              <span className="text-slate-400 font-mono">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${uploadProgress || 30}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Banner */}
        {uploadStep === "SUCCESS" && (
          <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong>Upload Confirmed!</strong> Audio securely stored in private bucket. Redirecting to call details...
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 pt-2">
          <Link
            href="/calls"
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !selectedFile}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
              isSubmitting || !selectedFile
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-cyan-500/20"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing Upload...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Ingest Call Recording</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
