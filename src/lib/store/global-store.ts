import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CallRecord, ProcessingEventRecord, ScorecardParameter } from "@/types/scorecard";
import {
  NormalizedUtterance,
  CallAudioMetrics,
  TranscriptionJobStatus,
} from "@/lib/providers/transcription/types";
import {
  StoredAuditReview,
  QAGoldLabel,
  CalibrationDataset,
  CalibrationDatasetItem,
  AIRecommendation,
} from "@/types/review";
import { INITIAL_ORGANIZATION, INITIAL_CAMPAIGN, INITIAL_AGENT, INITIAL_SCORECARD } from "@/lib/seed-data";

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

export interface StoredSpeakerReview {
  id: string;
  transcript_id: string;
  speaker_label: string;
  original_role: string;
  reviewed_role: string;
  reviewer_id?: string;
  reason?: string;
  created_at: string;
}

export interface StoredAuditEvidence {
  id: string;
  utterance_id: string;
  prompt_id: string;
  start_ms: number;
  end_ms: number;
  speaker_role: string;
  quote_text: string;
}

export interface StoredAuditParameterResult {
  id: string;
  audit_id: string;
  parameter_id: string;
  parameter_name: string;
  section_name: string;
  max_weight: number;
  awarded_points: number;
  result: "PASS" | "PARTIAL" | "FAIL" | "REVIEW_REQUIRED" | "NOT_APPLICABLE";
  audit_source: "TRANSCRIPT" | "AUDIO" | "KNOWLEDGE_BASE" | "CRM" | "HYBRID" | "MANUAL";
  confidence?: number;
  reason?: string;
  failure_reason_code?: string;
  requires_human_review: boolean;
  evidence: StoredAuditEvidence[];
}

export interface StoredAudit {
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
  ai_coverage?: number;
  ai_recommendation?: AIRecommendation;
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

export interface StoredAuditRun {
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

export type ScoringPolicyMode =
  | "BINARY"
  | "RULE_WEIGHTED"
  | "DEDUCTION"
  | "RUBRIC"
  | "MANUAL";

export interface ParameterScoringPolicy {
  parameterId: string;
  mode: ScoringPolicyMode;
  config: Record<string, unknown>;
}

export interface CachedAudioItem {
  buffer: Buffer;
  contentType: string;
}

export interface GlobalDataStores {
  calls: Map<string, CallRecord>;
  events: Map<string, ProcessingEventRecord[]>;
  jobs: Map<string, StoredTranscriptionJob>;
  transcripts: Map<string, StoredTranscript[]>;
  utterances: Map<string, NormalizedUtterance[]>;
  audioMetrics: Map<string, CallAudioMetrics>;
  speakerReviews: Map<string, StoredSpeakerReview[]>;
  auditRuns: Map<string, StoredAuditRun>;
  audits: Map<string, StoredAudit>;
  reviews: Map<string, StoredAuditReview>;
  auditToReviewIndex: Map<string, string>;
  goldLabels: Map<string, QAGoldLabel>;
  calibrationDatasets: Map<string, CalibrationDataset>;
  calibrationDatasetItems: Map<string, CalibrationDatasetItem[]>;
  audioCache: Map<string, CachedAudioItem>;
  scoringPolicies: Map<string, ParameterScoringPolicy>;
  saveState: () => void;
}

const GLOBAL_STORE_KEY = Symbol.for("__AI_CALL_QA_GLOBAL_STORE__");

// Initial Seed Demo Call
export const INITIAL_DEMO_CALL: CallRecord = {
  id: "c1000000-0000-0000-0000-000000000001",
  organization_id: INITIAL_ORGANIZATION.id,
  campaign_id: INITIAL_CAMPAIGN.id,
  agent_id: INITIAL_AGENT.id,
  scorecard_id: INITIAL_SCORECARD.id,
  external_call_id: "EXT-889021",
  client_request_id: "req_demo_2533730",
  jira_transaction_number: "NGCC-2533730",
  customer_phone_masked: "*9088",
  interaction_date: "2026-09-04",
  interaction_time: "08:46:00",
  issue_type: "Account & Data Inquiry",
  query_count: 1,
  audio_storage_path: `${INITIAL_ORGANIZATION.id}/${INITIAL_CAMPAIGN.id}/c1000000-0000-0000-0000-000000000001/customer-support-call.mp3`,
  original_filename: "customer-support-call.mp3",
  audio_content_type: "audio/mpeg",
  audio_size_bytes: 4325120,
  duration_seconds: 272,
  language: "en",
  processing_status: "UPLOADED",
  uploaded_at: "2026-09-04T08:50:00.000Z",
  created_at: "2026-09-04T08:47:00.000Z",
  updated_at: "2026-09-04T08:50:00.000Z",
  agent_name: INITIAL_AGENT.name,
  campaign_name: INITIAL_CAMPAIGN.name,
  scorecard_name: INITIAL_SCORECARD.name,
};

function getDataDir(): string {
  const dir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignored if directory exists or created concurrently
    }
  }
  return dir;
}

function getAudioDir(): string {
  const dir = path.join(getDataDir(), "audio");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Ignored
    }
  }
  return dir;
}

function getStateFilePath(): string {
  return path.join(getDataDir(), "qa_platform_state.json");
}

function encodePathKey(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}

function initializeStores(): GlobalDataStores {
  const calls = new Map<string, CallRecord>();
  const events = new Map<string, ProcessingEventRecord[]>();
  const jobs = new Map<string, StoredTranscriptionJob>();
  const transcripts = new Map<string, StoredTranscript[]>();
  const utterances = new Map<string, NormalizedUtterance[]>();
  const audioMetrics = new Map<string, CallAudioMetrics>();
  const speakerReviews = new Map<string, StoredSpeakerReview[]>();
  const auditRuns = new Map<string, StoredAuditRun>();
  const audits = new Map<string, StoredAudit>();
  const reviews = new Map<string, StoredAuditReview>();
  const auditToReviewIndex = new Map<string, string>();
  const goldLabels = new Map<string, QAGoldLabel>();
  const calibrationDatasets = new Map<string, CalibrationDataset>();
  const calibrationDatasetItems = new Map<string, CalibrationDatasetItem[]>();
  const audioCache = new Map<string, CachedAudioItem>();
  const scoringPolicies = new Map<string, ParameterScoringPolicy>();

  // 1. Try to load from disk
  const stateFile = getStateFilePath();
  if (fs.existsSync(stateFile)) {
    try {
      const raw = fs.readFileSync(stateFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.calls) {
        for (const [k, v] of Object.entries(parsed.calls)) calls.set(k, v as CallRecord);
      }
      if (parsed.events) {
        for (const [k, v] of Object.entries(parsed.events)) events.set(k, v as ProcessingEventRecord[]);
      }
      if (parsed.jobs) {
        for (const [k, v] of Object.entries(parsed.jobs)) jobs.set(k, v as StoredTranscriptionJob);
      }
      if (parsed.transcripts) {
        for (const [k, v] of Object.entries(parsed.transcripts)) transcripts.set(k, v as StoredTranscript[]);
      }
      if (parsed.utterances) {
        for (const [k, v] of Object.entries(parsed.utterances)) utterances.set(k, v as NormalizedUtterance[]);
      }
      if (parsed.audioMetrics) {
        for (const [k, v] of Object.entries(parsed.audioMetrics)) audioMetrics.set(k, v as CallAudioMetrics);
      }
      if (parsed.speakerReviews) {
        for (const [k, v] of Object.entries(parsed.speakerReviews)) speakerReviews.set(k, v as StoredSpeakerReview[]);
      }
      if (parsed.auditRuns) {
        for (const [k, v] of Object.entries(parsed.auditRuns)) auditRuns.set(k, v as StoredAuditRun);
      }
      if (parsed.audits) {
        for (const [k, v] of Object.entries(parsed.audits)) audits.set(k, v as StoredAudit);
      }
      if (parsed.reviews) {
        for (const [k, v] of Object.entries(parsed.reviews)) reviews.set(k, v as StoredAuditReview);
      }
      if (parsed.auditToReviewIndex) {
        for (const [k, v] of Object.entries(parsed.auditToReviewIndex)) auditToReviewIndex.set(k, v as string);
      }
      if (parsed.goldLabels) {
        for (const [k, v] of Object.entries(parsed.goldLabels)) goldLabels.set(k, v as QAGoldLabel);
      }
      if (parsed.calibrationDatasets) {
        for (const [k, v] of Object.entries(parsed.calibrationDatasets)) calibrationDatasets.set(k, v as CalibrationDataset);
      }
      if (parsed.calibrationDatasetItems) {
        for (const [k, v] of Object.entries(parsed.calibrationDatasetItems)) calibrationDatasetItems.set(k, v as CalibrationDatasetItem[]);
      }
      if (parsed.scoringPolicies) {
        for (const [k, v] of Object.entries(parsed.scoringPolicies)) scoringPolicies.set(k, v as ParameterScoringPolicy);
      }
    } catch (err) {
      console.warn("Failed to load existing QA platform state from disk:", err);
    }
  }

  // 2. Ensure initial demo call exists
  if (!calls.has(INITIAL_DEMO_CALL.id)) {
    calls.set(INITIAL_DEMO_CALL.id, INITIAL_DEMO_CALL);
    events.set(INITIAL_DEMO_CALL.id, [
      {
        id: "evt_1",
        call_id: INITIAL_DEMO_CALL.id,
        stage: "UPLOAD",
        status: "COMPLETED",
        message: "Call recording uploaded and stored in private bucket.",
        created_at: "2026-09-04T08:50:00.000Z",
      },
    ]);
  }

  let saveTimer: NodeJS.Timeout | null = null;
  const saveState = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const payload = {
          calls: Object.fromEntries(calls),
          events: Object.fromEntries(events),
          jobs: Object.fromEntries(jobs),
          transcripts: Object.fromEntries(transcripts),
          utterances: Object.fromEntries(utterances),
          audioMetrics: Object.fromEntries(audioMetrics),
          speakerReviews: Object.fromEntries(speakerReviews),
          auditRuns: Object.fromEntries(auditRuns),
          audits: Object.fromEntries(audits),
          reviews: Object.fromEntries(reviews),
          auditToReviewIndex: Object.fromEntries(auditToReviewIndex),
          goldLabels: Object.fromEntries(goldLabels),
          calibrationDatasets: Object.fromEntries(calibrationDatasets),
          calibrationDatasetItems: Object.fromEntries(calibrationDatasetItems),
          scoringPolicies: Object.fromEntries(scoringPolicies),
        };
        const tempPath = `${stateFile}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf-8");
        fs.renameSync(tempPath, stateFile);
      } catch (err) {
        console.error("Failed to persist QA platform state to disk:", err);
      }
    }, 50);
  };

  return {
    calls,
    events,
    jobs,
    transcripts,
    utterances,
    audioMetrics,
    speakerReviews,
    auditRuns,
    audits,
    reviews,
    auditToReviewIndex,
    goldLabels,
    calibrationDatasets,
    calibrationDatasetItems,
    audioCache,
    scoringPolicies,
    saveState,
  };
}

// Global accessor guaranteeing singleton across HMR, Next.js chunk boundaries, and route entries
export function getGlobalStores(): GlobalDataStores {
  const globalObj = globalThis as unknown as Record<symbol, GlobalDataStores>;
  if (!globalObj[GLOBAL_STORE_KEY]) {
    globalObj[GLOBAL_STORE_KEY] = initializeStores();
  }
  return globalObj[GLOBAL_STORE_KEY];
}

// Audio persistence helpers
export function persistAudioToDisk(storagePath: string, buffer: Buffer, contentType: string): void {
  try {
    const audioDir = getAudioDir();
    const hexName = encodePathKey(storagePath);
    const audioFile = path.join(audioDir, `${hexName}.bin`);
    const metaFile = path.join(audioDir, `${hexName}.meta.json`);
    fs.writeFileSync(audioFile, buffer);
    fs.writeFileSync(metaFile, JSON.stringify({ contentType, originalPath: storagePath }));
  } catch (err) {
    console.warn("Failed to persist audio buffer to disk:", err);
  }
}

export function loadAudioFromDisk(storagePath: string): CachedAudioItem | undefined {
  try {
    const audioDir = getAudioDir();
    const hexName = encodePathKey(storagePath);
    const audioFile = path.join(audioDir, `${hexName}.bin`);
    const metaFile = path.join(audioDir, `${hexName}.meta.json`);
    if (fs.existsSync(audioFile) && fs.existsSync(metaFile)) {
      const buffer = fs.readFileSync(audioFile);
      const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
      return { buffer, contentType: meta.contentType || "audio/mpeg" };
    }
  } catch (err) {
    console.warn("Failed to read audio buffer from disk:", err);
  }
  return undefined;
}
