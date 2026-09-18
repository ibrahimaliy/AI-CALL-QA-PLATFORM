"use client";

import React, { useState, useId, useRef, useEffect, useCallback } from "react";
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
  X,
} from "lucide-react";
import {
  INITIAL_AGENT,
  INITIAL_CAMPAIGN,
  INITIAL_SCORECARD,
  INITIAL_ORGANIZATION,
  SAMPLE_AGENTS,
  SAMPLE_CAMPAIGNS,
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
  const [selectedAgentId, setSelectedAgentId] = useState<string>(INITIAL_AGENT.id);
  const [customAgentName, setCustomAgentName] = useState("");
  const [customAgentCode, setCustomAgentCode] = useState("");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(INITIAL_CAMPAIGN.id);
  const [customCampaignName, setCustomCampaignName] = useState("");

  const [scorecardId, setScorecardId] = useState(INITIAL_SCORECARD.id);
  const [interactionDate, setInteractionDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [interactionTime, setInteractionTime] = useState(() => new Date().toTimeString().slice(0, 8));
  const [jiraTransaction, setJiraTransaction] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueType, setIssueType] = useState("Account & Service Inquiry");
  const [queryCount, setQueryCount] = useState(1);
  const [externalCallId, setExternalCallId] = useState("");
  const [notes, setNotes] = useState("");

  const handleAutoGenerateJira = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000);
    setJiraTransaction(`NGCC-${randomDigits}`);
  };

  const handleAutoGenerateTelephony = () => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    setExternalCallId(`EXT-${randomDigits}`);
  };

  // File & Drag-and-Drop State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadStep, setUploadStep] = useState<UploadStep>("IDLE");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>("Uploading recording...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCallId, setCreatedCallId] = useState<string | null>(null);

  // Prevent browser default behavior of opening and playing media files dropped anywhere in the window
  useEffect(() => {
    const preventDefaults = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("dragover", preventDefaults);
    window.addEventListener("drop", preventDefaults);

    return () => {
      window.removeEventListener("dragover", preventDefaults);
      window.removeEventListener("drop", preventDefaults);
    };
  }, []);

  // Client request ID (Idempotency key per form lifecycle)
  const [clientRequestId, setClientRequestId] = useState(() => `req_${crypto.randomUUID()}`);

  const validateAndSetFile = useCallback((file: File) => {
    setErrorMessage(null);

    // Client validation for file size
    if (file.size > STORAGE_CONFIG.MAX_CALL_UPLOAD_BYTES) {
      setErrorMessage(
        `Selected file exceeds the maximum allowed limit of ${STORAGE_CONFIG.MAX_CALL_UPLOAD_MB} MB.`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Client validation for file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!STORAGE_CONFIG.ALLOWED_EXTENSIONS.some((e) => e === ext)) {
      setErrorMessage(
        `Unsupported format (${ext}). Allowed formats: ${STORAGE_CONFIG.ALLOWED_EXTENSIONS.join(
          ", "
        )}`
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      return;
    }
    validateAndSetFile(e.target.files[0]);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (isSubmitting) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      // 1. Resolve Agent attributes
      let resolvedAgentId = selectedAgentId;
      let resolvedAgentName = INITIAL_AGENT.name;
      let resolvedAgentCode = INITIAL_AGENT.employee_code;

      if (selectedAgentId === "__CUSTOM__") {
        resolvedAgentId = crypto.randomUUID();
        resolvedAgentName = customAgentName.trim() || "Custom Support Agent";
        resolvedAgentCode = customAgentCode.trim() || `AGT-${resolvedAgentId.slice(0, 4).toUpperCase()}`;
      } else {
        const found = SAMPLE_AGENTS.find((a) => a.id === selectedAgentId);
        if (found) {
          resolvedAgentName = found.name;
          resolvedAgentCode = found.employee_code;
        }
      }

      // 2. Resolve Campaign attributes
      let resolvedCampaignId = selectedCampaignId;
      let resolvedCampaignName = INITIAL_CAMPAIGN.name;

      if (selectedCampaignId === "__CUSTOM__") {
        resolvedCampaignId = crypto.randomUUID();
        resolvedCampaignName = customCampaignName.trim() || "Custom Queue / Line of Business";
      } else {
        const found = SAMPLE_CAMPAIGNS.find((c) => c.id === selectedCampaignId);
        if (found) {
          resolvedCampaignName = found.name;
        }
      }

      // 3. Mask customer phone number per Section 19: e.g. *9088
      const trimmedPhone = customerPhone.trim();
      const maskedPhone =
        trimmedPhone.length > 4
          ? `*${trimmedPhone.slice(-4)}`
          : trimmedPhone || null;

      // 4. Request Upload Authorization (POST /api/calls/upload-intent)
      setUploadStep("CREATING_CALL");

      const intentRes = await fetch("/api/calls/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: resolvedAgentId,
          agentName: resolvedAgentName,
          agentEmployeeCode: resolvedAgentCode,
          campaignId: resolvedCampaignId,
          campaignName: resolvedCampaignName,
          scorecardId,
          scorecardName: INITIAL_SCORECARD.name,
          interactionDate,
          interactionTime,
          jiraTransactionNumber: jiraTransaction.trim() || null,
          customerPhoneMasked: maskedPhone,
          issueType: issueType.trim() || "General Inquiry",
          queryCount,
          externalCallId: externalCallId.trim() || null,
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
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <optgroup label="Registered Agents">
                  {SAMPLE_AGENTS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.employee_code})
                    </option>
                  ))}
                </optgroup>
                <option value="__CUSTOM__">➕ Add Custom Support Agent...</option>
              </select>
            </div>

            {/* Campaign */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Campaign / Line of Business *
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2.5 focus:outline-none focus:border-cyan-500"
              >
                <optgroup label="Standard Campaigns">
                  {SAMPLE_CAMPAIGNS.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name}
                    </option>
                  ))}
                </optgroup>
                <option value="__CUSTOM__">➕ Add Custom Campaign / Queue...</option>
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

          {/* Conditional Custom Agent Fields */}
          {selectedAgentId === "__CUSTOM__" && (
            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-cyan-300 mb-1">
                  Custom Agent Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sarah Jenkins or Aisha Bello"
                  value={customAgentName}
                  onChange={(e) => setCustomAgentName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-cyan-700/60 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-cyan-300 mb-1">
                  Agent Employee Code / ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. AGT-2041"
                  value={customAgentCode}
                  onChange={(e) => setCustomAgentCode(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 border border-cyan-700/60 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          )}

          {/* Conditional Custom Campaign Fields */}
          {selectedCampaignId === "__CUSTOM__" && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40">
              <label className="block text-xs font-medium text-indigo-300 mb-1">
                Custom Campaign / Line of Business Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Fiber Retention & Escalations"
                value={customCampaignName}
                onChange={(e) => setCustomCampaignName(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-slate-900 border border-indigo-700/60 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-indigo-400"
              />
            </div>
          )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  JIRA Transaction Ref
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateJira}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Auto-Gen
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. NGCC-2533730"
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
                placeholder="e.g. 07020209088"
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
                list="common-issue-types"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                disabled={isSubmitting}
                placeholder="Select or enter issue type..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-cyan-500"
              />
              <datalist id="common-issue-types">
                <option value="Account & Service Inquiry" />
                <option value="Network & Connectivity Issue" />
                <option value="Billing & Recharge Dispute" />
                <option value="SIM Registration & KYC" />
                <option value="Broadband / Router Troubleshooting" />
                <option value="Value-Added Services (VAS)" />
                <option value="Complaint & Supervisor Escalation" />
                <option value="Product & Tariff Information" />
              </datalist>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  External Call ID (Telephony Ref)
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateTelephony}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Auto-Gen
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. EXT-991204"
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

          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
              isDragging
                ? "border-cyan-400 bg-cyan-950/50 ring-4 ring-cyan-500/20 scale-[1.01]"
                : selectedFile
                ? "border-cyan-800/80 bg-cyan-950/20 hover:border-cyan-700"
                : "border-slate-800 hover:border-cyan-500/50 bg-slate-950/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              id="audio-upload-input"
              accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="hidden"
            />

            {isDragging ? (
              <div className="flex flex-col items-center space-y-3 pointer-events-none py-2">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 flex items-center justify-center animate-pulse">
                  <UploadCloud className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-base font-bold text-cyan-300">
                  Drop audio recording here to upload
                </div>
                <div className="text-xs text-cyan-400/80">
                  Supported formats: MP3, WAV, M4A, AAC
                </div>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-3 text-left overflow-hidden w-full">
                  <div className="w-11 h-11 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center justify-center shrink-0">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="truncate min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-200 truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono text-cyan-300">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <span>•</span>
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {selectedFile.name.split(".").pop()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <label
                    htmlFor="audio-upload-input"
                    className={`cursor-pointer px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 ${
                      isSubmitting ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    Change File
                  </label>
                  {!isSubmitting && (
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors border border-transparent hover:border-red-900/50"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <label
                htmlFor="audio-upload-input"
                className="cursor-pointer flex flex-col items-center space-y-2 select-none"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center justify-center transition-transform hover:scale-105">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-200">
                  Click to select or drag audio recording
                </div>
                <div className="text-xs text-slate-400">
                  Supported formats: MP3, WAV, M4A, AAC
                </div>
                <div className="text-[11px] text-slate-500">
                  Drop audio file directly anywhere in this box
                </div>
              </label>
            )}
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
