import {
  TranscriptionProvider,
  NormalizedTranscriptResult,
  NormalizedUtterance,
  CallAudioMetrics,
  SpeakerRole,
  TranscriptionJobStatus,
} from "@/lib/providers/transcription/types";
import { createTranscriptionProvider } from "./provider-factory";
import { MockTranscriptionProvider } from "@/lib/providers/transcription/mock.provider";
import { validateTranscriptResult, TranscriptValidationError } from "./transcript-validator";
import { SpeakerRoleMapper } from "./speaker-role-mapper";
import { calculateBasicAudioMetrics } from "./audio-metrics";
import { assertValidStatusTransition } from "../calls/state-machine";
import { AuthorizationService, UserAuthContext } from "../auth/authorization";
import { StorageService } from "@/lib/storage/storage.service";
import { CallRecord, ProcessingEventRecord } from "@/types/scorecard";
import { getGlobalStores } from "@/lib/store/global-store";
import { CallService } from "../calls/call.service";
import crypto from "crypto";
import { SupabaseRepository } from "@/lib/db/supabase-repository";

// Transcript storage interface
export interface StoredTranscript {
  id: string;
  call_id: string;
  version: number;
  is_active: boolean;
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
  source_recording_checksum?: string | null;
  speech_model_used?: string | null;
  provider_metadata?: Record<string, unknown> | null;
}

// Transcription job storage interface
export interface StoredTranscriptionJob {
  id: string;
  call_id: string;
  provider: string;
  provider_transcript_id: string;
  status: TranscriptionJobStatus;
  attempt_number: number;
  submitted_at: string;
  completed_at?: string | null;
  failed_at?: string | null;
  error_message?: string | null;
  source_recording_checksum?: string | null;
  source_audio_size_bytes?: number | null;
  source_audio_duration_ms?: number | null;
  requested_speech_models?: string[] | null;
  speech_model_used?: string | null;
  provider_metadata?: Record<string, unknown> | null;
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

// Central global stores singleton
const globalStores = getGlobalStores();
const jobsStore = globalStores.jobs;
const transcriptsStore = globalStores.transcripts;
const utterancesStore = globalStores.utterances;
const audioMetricsStore = globalStores.audioMetrics;
const speakerReviewsStore = globalStores.speakerReviews;

export class TranscriptionService {
  /**
   * Submits an uploaded call for transcription.
   * Specification Sections 1, 5, 6, 7, 8, 9, 10.
   */
  static async submitCallForTranscription(
    call: CallRecord,
    userContext: UserAuthContext,
    options?: { speakerMode?: "AUTO" | "EXACT_TWO"; forceMock?: boolean }
  ): Promise<{ job: StoredTranscriptionJob; isNew: boolean }> {
    AuthorizationService.assertCanCreateCall(userContext);
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // 1. Check call state
    if (call.processing_status !== "UPLOADED" && call.processing_status !== "FAILED") {
      throw new Error(
        `Cannot start transcription for call in status '${call.processing_status}'. Expected 'UPLOADED' or 'FAILED'.`
      );
    }

    // 2. Storage object & recording identity check (Section 5 & 6)
    if (!call.audio_storage_path) {
      throw new Error("No audio storage path recorded for this call.");
    }

    // 3. Strict fail-closed provider selection (Section 1)
    let provider: TranscriptionProvider;
    if (options?.forceMock) {
      const mockEnabled = process.env.ENABLE_MOCK_TRANSCRIPTION === "true";
      if (process.env.NODE_ENV === "production" || !mockEnabled) {
        throw new Error("Mock transcription is disabled in this environment.");
      }
      provider = new MockTranscriptionProvider();
    } else {
      provider = createTranscriptionProvider();
    }

    // 4. Deterministic Cache / Idempotency Key (Section 8)
    const targetSpeechModels = ["universal-3-pro", "universal-2"];
    const cacheIdentityHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          callId: call.id,
          recordingChecksum: call.recording_checksum,
          provider: provider.name,
          requestedSpeechModels: targetSpeechModels,
          language: "en",
          speakerDiarizationConfig: { speakerMode: options?.speakerMode || "AUTO", expected: 2 },
          transcriptionConfigVersion: "v2",
        })
      )
      .digest("hex");

    // Check for already processing job
    for (const j of jobsStore.values()) {
      if (j.call_id === call.id && (j.status === "PROCESSING" || j.status === "QUEUED")) {
        return { job: j, isNew: false };
      }
    }

    // 5. Generate signed playback / download URL for AssemblyAI (30-60 min validity)
    const signed = await StorageService.generateSignedPlaybackUrl(call.audio_storage_path, 3600);

    // 6. Submit to provider with timeout and error handling
    const webhookUrl = process.env.ASSEMBLYAI_WEBHOOK_URL;
    const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;

    let submission;
    try {
      submission = await provider.submit({
        audioUrl: call.audio_storage_path, // AssemblyAI provider handles external signed or direct upload
        language: "en",
        speakerMode: options?.speakerMode || "AUTO",
        webhookUrl: webhookUrl || undefined,
        webhookAuthSecret: webhookSecret || undefined,
        enableWordTimestamps: true,
        speechModels: targetSpeechModels,
        sourceRecordingChecksum: call.recording_checksum || undefined,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transcription submission failed.";
      call.processing_status = "FAILED";
      call.processing_error = message;
      call.updated_at = new Date().toISOString();
      CallService.updateCall(call);

      CallService.addProcessingEvent(call.id, {
        stage: "TRANSCRIPTION",
        status: "FAILED",
        message: `Provider submission failed: ${message}`,
        metadata: { provider: provider.name, error: message },
        created_at: new Date().toISOString(),
      });
      throw err;
    }

    // 7. Create transcription job record with recording checksum binding (Section 7)
    const attemptCount = Array.from(jobsStore.values()).filter((j) => j.call_id === call.id).length + 1;
    const jobId = crypto.randomUUID();
    const job: StoredTranscriptionJob = {
      id: jobId,
      call_id: call.id,
      provider: provider.name,
      provider_transcript_id: submission.providerTranscriptId,
      status: submission.status,
      attempt_number: attemptCount,
      submitted_at: new Date().toISOString(),
      source_recording_checksum: call.recording_checksum || null,
      source_audio_size_bytes: call.audio_size_bytes || null,
      source_audio_duration_ms: call.audio_duration_ms || (call.duration_seconds ? call.duration_seconds * 1000 : null),
      requested_speech_models: targetSpeechModels,
      provider_metadata: {
        cacheIdentityHash,
      },
    };
    jobsStore.set(submission.providerTranscriptId, job);
    if (SupabaseRepository.isEnabled()) {
      await SupabaseRepository.saveTranscriptionJob(job);
    }

    // 8. Update Call status: UPLOADED -> TRANSCRIBING
    assertValidStatusTransition(call.processing_status, "TRANSCRIBING", call.id);
    call.processing_status = "TRANSCRIBING";
    call.updated_at = new Date().toISOString();
    CallService.updateCall(call);

    // 9. Log processing event
    CallService.addProcessingEvent(call.id, {
      stage: "TRANSCRIPTION",
      status: "IN_PROGRESS",
      message: `Transcription job submitted to ${provider.name} (Job ID: ${submission.providerTranscriptId}).`,
      metadata: {
        provider: provider.name,
        providerTranscriptId: submission.providerTranscriptId,
        attemptNumber: attemptCount,
        recordingChecksum: call.recording_checksum,
        requestedSpeechModels: targetSpeechModels,
      },
      created_at: new Date().toISOString(),
    });

    globalStores.saveState();
    return { job, isNew: true };
  }

  /**
   * Handles incoming provider webhook completion or polling completion.
   * Specification Sections 6, 7, 11, 12, 14, 15, 16, 17.
   */
  static async handleProviderCompletion(
    providerTranscriptId: string,
    status: "completed" | "error",
    call?: CallRecord,
    errorMessage?: string,
    forceProvider?: TranscriptionProvider
  ): Promise<{ success: boolean; alreadyProcessed?: boolean; transcript?: StoredTranscript; error?: string }> {
    let job = jobsStore.get(providerTranscriptId);
    if (!job && SupabaseRepository.isEnabled()) {
      job = (await SupabaseRepository.getTranscriptionJob(providerTranscriptId)) || undefined;
      if (job) jobsStore.set(providerTranscriptId, job);
    }

    // Resolve target call
    let targetCall = call;
    if (!targetCall && job) {
      targetCall = (await CallService.getCallRecord(job.call_id)) || CallService.getRawCall(job.call_id);
    }

    if (!targetCall) {
      throw new Error(`Target call for provider transcript [${providerTranscriptId}] not found.`);
    }

    // Idempotency check: if already completed, return immediately without duplicate writes
    if (job && job.status === "COMPLETED") {
      const list = transcriptsStore.get(targetCall.id) || [];
      const existing =
        list.find((t) => t.provider_transcript_id === providerTranscriptId) ||
        (list.length > 0 ? list[list.length - 1] : undefined);
      return { success: true, alreadyProcessed: true, transcript: existing };
    }

    if (status === "error") {
      if (job) {
        job.status = "FAILED";
        job.failed_at = new Date().toISOString();
        job.error_message = errorMessage || "Transcription failed at provider.";
        if (SupabaseRepository.isEnabled()) {
          await SupabaseRepository.saveTranscriptionJob(job);
        }
      }
      targetCall.processing_status = "FAILED";
      targetCall.processing_error = errorMessage || "Transcription provider error.";
      targetCall.updated_at = new Date().toISOString();
      CallService.updateCall(targetCall);

      CallService.addProcessingEvent(targetCall.id, {
        stage: "TRANSCRIPTION",
        status: "FAILED",
        message: errorMessage || "Transcription failed at provider.",
        metadata: { providerTranscriptId, error: errorMessage },
        created_at: new Date().toISOString(),
      });

      globalStores.saveState();
      return { success: false, error: errorMessage };
    }

    // Retrieve full completed transcript from provider
    let provider = forceProvider;
    if (!provider) {
      if (job?.provider === "MOCK_PROVIDER" || job?.provider === "mock") {
        provider = new MockTranscriptionProvider();
      } else {
        provider = createTranscriptionProvider();
      }
    }

    const result: NormalizedTranscriptResult = await provider.getResult(providerTranscriptId);

    // Calculate expected duration
    let expectedAudioDurationMs =
      targetCall.audio_duration_ms ||
      (targetCall.duration_seconds ? targetCall.duration_seconds * 1000 : 0);

    if (expectedAudioDurationMs === 0 && targetCall.audio_size_bytes && targetCall.audio_size_bytes > 50000) {
      // 8kHz 16-bit mono WAV = 16 bytes per ms
      expectedAudioDurationMs = Math.round(targetCall.audio_size_bytes / 16);
    }

    // Run strict transcript validations (Sections 6, 11, 12, 14, 15, 16)
    try {
      validateTranscriptResult({
        callId: targetCall.id,
        expectedAudioDurationMs,
        providerAudioDurationMs: result.audioDurationMs,
        utterances: result.utterances,
        fullText: result.fullText,
        provider: result.provider,
        jobChecksum: job?.source_recording_checksum,
        callChecksum: targetCall.recording_checksum,
        allowMock: process.env.ENABLE_MOCK_TRANSCRIPTION === "true" && process.env.NODE_ENV !== "production",
      });
    } catch (valErr: unknown) {
      const errCode = valErr instanceof TranscriptValidationError ? valErr.code : "TRANSCRIPT_VALIDATION_ERROR";
      const errMsg = valErr instanceof Error ? valErr.message : errCode;

      if (job) {
        job.status = "FAILED";
        job.failed_at = new Date().toISOString();
        job.error_message = `${errCode}: ${errMsg}`;
        if (SupabaseRepository.isEnabled()) {
          await SupabaseRepository.saveTranscriptionJob(job);
        }
      }

      targetCall.processing_status = "FAILED";
      targetCall.processing_error = `${errCode}: ${errMsg}`;
      targetCall.updated_at = new Date().toISOString();
      CallService.updateCall(targetCall);

      CallService.addProcessingEvent(targetCall.id, {
        stage: "TRANSCRIPTION",
        status: "FAILED",
        message: `Transcript rejected by validation: ${errCode} - ${errMsg}`,
        metadata: {
          errorCode: errCode,
          providerTranscriptId,
          expectedDurationMs: expectedAudioDurationMs,
          providerDurationMs: result.audioDurationMs,
          utteranceCount: result.utterances.length,
        },
        created_at: new Date().toISOString(),
      });

      globalStores.saveState();
      return { success: false, error: `${errCode}: ${errMsg}` };
    }

    // Apply speaker role mapping heuristic
    const roleMapping = SpeakerRoleMapper.mapRoles(result.utterances, targetCall.agent_name);

    // Compute basic audio conversational metrics
    const metrics = calculateBasicAudioMetrics(
      targetCall.id,
      roleMapping.mappedUtterances,
      result.audioDurationMs
    );
    audioMetricsStore.set(targetCall.id, metrics);

    // Transactional persistence with version activation (Section 17)
    // Only deactivate previous transcripts AFTER new transcript passes validation!
    const now = new Date().toISOString();
    const existingList = transcriptsStore.get(targetCall.id) || [];
    existingList.forEach((t) => {
      t.is_active = false;
    });

    const speechModelUsed = result.speechModelUsed || "universal-3-pro";
    const newVersion = existingList.length + 1;
    const transcriptId = crypto.randomUUID();
    const transcript: StoredTranscript = {
      id: transcriptId,
      call_id: targetCall.id,
      version: newVersion,
      is_active: true,
      provider: result.provider,
      provider_transcript_id: providerTranscriptId,
      full_text: result.fullText,
      language: result.language,
      confidence: result.confidence,
      audio_duration_ms: result.audioDurationMs,
      requires_speaker_review: roleMapping.requiresSpeakerReview,
      requires_transcript_review: result.requiresTranscriptReview || false,
      transcript_review_reason: roleMapping.reviewReason || result.transcriptReviewReason || null,
      created_at: now,
      source_recording_checksum: targetCall.recording_checksum || job?.source_recording_checksum || null,
      speech_model_used: speechModelUsed,
      provider_metadata: result.providerMetadata || null,
    };

    const finalizedUtterances = roleMapping.mappedUtterances.map((u, idx) => ({
      ...u,
      id: u.id || crypto.randomUUID(),
    }));

    existingList.push(transcript);
    transcriptsStore.set(targetCall.id, existingList);
    utterancesStore.set(transcriptId, finalizedUtterances);
    utterancesStore.set(targetCall.id, finalizedUtterances);

    // Update job status and model metadata
    if (job) {
      job.status = "COMPLETED";
      job.completed_at = now;
      job.speech_model_used = speechModelUsed;
      job.provider_metadata = {
        ...(job.provider_metadata || {}),
        ...(result.providerMetadata || {}),
        speechModelUsed,
        audioDurationMs: result.audioDurationMs,
        utteranceCount: result.utterances.length,
      };
    }

    // Persist transcript, utterances, metrics, and job to Supabase
    if (SupabaseRepository.isEnabled()) {
      try {
        await SupabaseRepository.saveTranscript(transcript, finalizedUtterances, metrics);
        if (job) {
          await SupabaseRepository.saveTranscriptionJob(job);
        }
      } catch (dbErr) {
        console.error("Failed to save transcript to Supabase:", dbErr);
      }
    }

    // Update call status: TRANSCRIBING -> TRANSCRIBED
    assertValidStatusTransition(targetCall.processing_status, "TRANSCRIBED", targetCall.id);
    targetCall.processing_status = "TRANSCRIBED";
    targetCall.processing_error = null;
    if (result.audioDurationMs > 0) {
      targetCall.audio_duration_ms = result.audioDurationMs;
      targetCall.duration_seconds = Math.round(result.audioDurationMs / 1000);
    }
    targetCall.updated_at = now;
    CallService.updateCall(targetCall);

    CallService.addProcessingEvent(targetCall.id, {
      stage: "TRANSCRIPTION",
      status: "COMPLETED",
      message: `Transcription completed. ${result.utterances.length} utterances parsed with speaker diarization. Model used: ${speechModelUsed}.`,
      metadata: {
        providerTranscriptId,
        speechModelUsed,
        utteranceCount: result.utterances.length,
        confidence: result.confidence,
        durationMs: result.audioDurationMs,
        requiresSpeakerReview: roleMapping.requiresSpeakerReview,
      },
      created_at: now,
    });

    globalStores.saveState();
    return { success: true, transcript };
  }

  /**
   * Checks and synchronizes active transcription job status directly with provider.
   * Useful in development when public webhooks cannot reach localhost.
   */
  static async syncJobStatus(callId: string): Promise<{ status: string; completed: boolean }> {
    const call = CallService.getRawCall(callId);
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }

    if (call.processing_status !== "TRANSCRIBING") {
      return { status: call.processing_status, completed: call.processing_status === "TRANSCRIBED" };
    }

    const jobs = Array.from(jobsStore.values()).filter((j) => j.call_id === callId);
    const pendingJob = jobs.find((j) => j.status === "PROCESSING" || j.status === "QUEUED");
    if (!pendingJob) {
      return { status: call.processing_status, completed: false };
    }

    // Check with provider
    if (pendingJob.provider === "ASSEMBLYAI") {
      const provider = createTranscriptionProvider();
      if (provider.getStatus) {
        const check = await provider.getStatus(pendingJob.provider_transcript_id);
        if (check.status === "COMPLETED") {
          await this.handleProviderCompletion(pendingJob.provider_transcript_id, "completed", call);
          return { status: "TRANSCRIBED", completed: true };
        } else if (check.status === "FAILED") {
          await this.handleProviderCompletion(
            pendingJob.provider_transcript_id,
            "error",
            call,
            check.error || "Provider error"
          );
          return { status: "FAILED", completed: false };
        }
      }
    }

    return { status: call.processing_status, completed: false };
  }

  /**
   * Retries transcription for a call that previously failed or needs re-processing.
   */
  static async retryTranscription(
    callId: string,
    userContext: UserAuthContext,
    options?: { speakerMode?: "AUTO" | "EXACT_TWO"; forceMock?: boolean }
  ): Promise<{ job: StoredTranscriptionJob; isNew: boolean }> {
    const call = CallService.getRawCall(callId);
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }
    AuthorizationService.assertCanCreateCall(userContext);
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // Reset status to UPLOADED so state-machine allows transition to TRANSCRIBING
    call.processing_status = "UPLOADED";
    call.processing_error = null;
    call.updated_at = new Date().toISOString();
    CallService.updateCall(call);

    // Cancel any previous hanging or unfinished jobs for this call
    for (const j of jobsStore.values()) {
      if (j.call_id === call.id && (j.status === "PROCESSING" || j.status === "QUEUED")) {
        j.status = "CANCELLED";
      }
    }

    CallService.addProcessingEvent(callId, {
      stage: "TRANSCRIPTION",
      status: "STARTED",
      message: "Transcription retry requested by user.",
      created_at: new Date().toISOString(),
    });

    globalStores.saveState();
    return this.submitCallForTranscription(call, userContext, options);
  }

  static getJobByProviderId(providerTranscriptId: string): StoredTranscriptionJob | undefined {
    return jobsStore.get(providerTranscriptId);
  }

  static async getJobsForCall(callId: string): Promise<StoredTranscriptionJob[]> {
    if (SupabaseRepository.isEnabled()) {
      const dbJobs = await SupabaseRepository.getTranscriptionJobsByCall(callId);
      if (dbJobs.length > 0) return dbJobs;
    }
    return Array.from(jobsStore.values()).filter((j) => j.call_id === callId);
  }

  /**
   * Retrieves transcript, utterances, audio metrics, and speaker review status for a call.
   */
  static async getCallTranscript(callId: string): Promise<{
    transcript: StoredTranscript | null;
    utterances: NormalizedUtterance[];
    metrics: CallAudioMetrics | null;
    speakerReviews: StoredSpeakerReview[];
  }> {
    let transcript: StoredTranscript | null = null;
    let utterances: NormalizedUtterance[] = [];
    let metrics: CallAudioMetrics | null = null;
    let speakerReviews: StoredSpeakerReview[] = [];

    if (SupabaseRepository.isEnabled()) {
      try {
        transcript = await SupabaseRepository.getActiveTranscript(callId);
        if (transcript) {
          utterances = await SupabaseRepository.getUtterances(transcript.id);
          metrics = await SupabaseRepository.getCallAudioMetrics(callId);
        }
      } catch (err) {
        console.error("Failed to load transcript from Supabase:", err);
      }
    }

    if (!transcript) {
      const list = transcriptsStore.get(callId) || [];
      transcript = list.find((t) => t.is_active) || (list.length > 0 ? list[list.length - 1] : null);
      utterances = utterancesStore.get(callId) || [];
      metrics = audioMetricsStore.get(callId) || null;
      speakerReviews = speakerReviewsStore.get(callId) || [];
    }

    return { transcript, utterances, metrics, speakerReviews };
  }

  /**
   * Returns immutable historical transcript versions for auditing.
   */
  static async getTranscriptHistory(callId: string): Promise<StoredTranscript[]> {
    return transcriptsStore.get(callId) || [];
  }

  /**
   * Allows a supervisor to correct speaker roles without altering original generic provider labels.
   */
  static async updateSpeakerRoles(
    callId: string,
    roleOverrides: Record<string, SpeakerRole>,
    userContext: UserAuthContext,
    reason?: string
  ): Promise<{ updatedCount: number; utterances: NormalizedUtterance[] }> {
    AuthorizationService.assertOrgAccess(userContext, userContext.organizationId);

    const utterances = utterancesStore.get(callId);
    const list = transcriptsStore.get(callId) || [];
    const transcript = list.find((t) => t.is_active) || (list.length > 0 ? list[list.length - 1] : null);

    if (!utterances || !transcript) {
      throw new Error(`No transcript found for call [${callId}].`);
    }

    const reviews: StoredSpeakerReview[] = speakerReviewsStore.get(callId) || [];
    let updatedCount = 0;

    // Apply role overrides
    for (const [label, newRole] of Object.entries(roleOverrides)) {
      const originalSample = utterances.find((u) => u.speakerLabel === label);
      const originalRole = originalSample?.speakerRole || "UNKNOWN";

      if (originalRole !== newRole) {
        reviews.push({
          id: crypto.randomUUID(),
          transcript_id: transcript.id,
          speaker_label: label,
          original_role: originalRole,
          reviewed_role: newRole,
          reviewer_id: userContext.userId,
          reason: reason || "Supervisor manual role confirmation.",
          created_at: new Date().toISOString(),
        });
      }
    }

    // Update utterances
    utterances.forEach((u) => {
      if (roleOverrides[u.speakerLabel]) {
        u.speakerRole = roleOverrides[u.speakerLabel];
        u.speakerRoleConfidence = 1.0; // human verified
        updatedCount++;
      }
    });

    transcript.requires_speaker_review = false;
    speakerReviewsStore.set(callId, reviews);

    // Recompute metrics with corrected roles
    const metrics = calculateBasicAudioMetrics(callId, utterances, transcript.audio_duration_ms);
    audioMetricsStore.set(callId, metrics);

    if (SupabaseRepository.isEnabled()) {
      try {
        await SupabaseRepository.updateSpeakerRoles(
          transcript.id,
          roleOverrides,
          userContext.userId,
          reason
        );
      } catch (err) {
        console.error("Failed to update speaker roles in Supabase:", err);
      }
    }

    globalStores.saveState();
    return { updatedCount, utterances };
  }
}
