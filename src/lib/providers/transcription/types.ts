// Provider Abstraction Layer: Normalized Transcription Types & Interfaces
// Specification Sections 2, 6, 7, 20, 21, 22

export type SpeakerRole =
  | "AGENT"
  | "CUSTOMER"
  | "IVR"
  | "SUPERVISOR"
  | "OTHER"
  | "UNKNOWN";

export type TranscriptionJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface NormalizedWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speakerLabel: string;
}

export interface NormalizedUtterance {
  id?: string;
  utteranceIndex: number;
  speakerLabel: string; // Original provider label (e.g. "A", "B")
  speakerRole?: SpeakerRole | null;
  speakerRoleConfidence?: number;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
  words?: NormalizedWord[];
  hasSpeakerOverlap?: boolean;
  speakerAttributionConfidence?: "HIGH" | "MEDIUM" | "LOW";
  requiresSpeakerReview?: boolean;
}

export interface NormalizedTranscriptResult {
  provider: string;
  providerTranscriptId: string;
  language: string;
  confidence: number;
  audioDurationMs: number;
  fullText: string;
  utterances: NormalizedUtterance[];
  requiresTranscriptReview?: boolean;
  transcriptReviewReason?: string | null;
  speechModelUsed?: string | null;
  providerMetadata?: Record<string, unknown>;
}

export interface TranscriptionRequest {
  audioUrl: string;
  language?: string;
  speakerMode?: "AUTO" | "EXACT_TWO" | number;
  webhookUrl?: string;
  webhookAuthSecret?: string;
  enableWordTimestamps?: boolean;
  speechModels?: string[];
  keytermsPrompt?: string[];
  prompt?: string;
  sourceRecordingChecksum?: string;
}

export interface TranscriptionSubmission {
  provider: string;
  providerTranscriptId: string;
  status: TranscriptionJobStatus;
  submittedAt: string;
  requestedSpeechModels?: string[];
  sourceRecordingChecksum?: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  submit(request: TranscriptionRequest): Promise<TranscriptionSubmission>;
  getResult(providerTranscriptId: string): Promise<NormalizedTranscriptResult>;
  getStatus?(providerTranscriptId: string): Promise<{ status: TranscriptionJobStatus; error?: string }>;
  cancel?(providerTranscriptId: string): Promise<void>;
}

export interface CallAudioMetrics {
  callId: string;
  speechDurationMs: number;
  agentUtteranceCount: number;
  customerUtteranceCount: number;
  agentWordCount: number;
  customerWordCount: number;
  speakerTurnCount: number;
  roughTalkRatio: number;
  roughSpeechRateWpm: number;
}
