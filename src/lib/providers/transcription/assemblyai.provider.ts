import {
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionSubmission,
  NormalizedTranscriptResult,
  NormalizedUtterance,
  NormalizedWord,
  TranscriptionJobStatus,
} from "./types";
import { z } from "zod";
import { getCachedAudio } from "@/lib/storage/audio-cache";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { STORAGE_CONFIG } from "@/lib/storage/config";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const TELECOM_KEYTERMS = [
  "Smile Communications",
  "Smile Telecom",
  "MySmile",
  "MySmile Voice",
  "Self Care",
  "voice bundle",
  "data bundle",
  "active bundle",
  "network issue",
  "Nigeria",
  "Play Store",
  "Apple Store",
  "smile.com.ng",
];

export const TELECOM_CONTEXT_PROMPT =
  "Transcribe this Nigerian telecom customer-service call faithfully. " +
  "There are expected to be two speakers: a customer-service agent and a customer. " +
  "Preserve hesitations, repetitions, false starts, fillers, incomplete sentences, and natural conversational speech because the transcript will be used for quality assurance. " +
  "Preserve numbers as spoken. " +
  "Do not rewrite sentences into more professional grammar. " +
  "Do not summarize. " +
  "Do not infer missing statements. " +
  "Important telecom and brand terms may include Smile Communications, MySmile, MySmile Voice, Self Care, voice bundle, data bundle, network issue, and smile.com.ng.";

const AssemblyAIWordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
  speaker: z.string().optional().nullable(),
});

const AssemblyAIUtteranceSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number(),
  words: z.array(AssemblyAIWordSchema).optional(),
});

const AssemblyAITranscriptResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "processing", "completed", "error"]),
  text: z.string().nullable().optional(),
  language_code: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  audio_duration: z.number().nullable().optional(), // in seconds
  speech_model_used: z.string().nullable().optional(),
  utterances: z.array(AssemblyAIUtteranceSchema).nullable().optional(),
  error: z.string().nullable().optional(),
});

export class AssemblyAITranscriptionProvider implements TranscriptionProvider {
  readonly name = "ASSEMBLYAI";
  private apiKey: string;
  private baseUrl = "https://api.assemblyai.com/v2";

  constructor(options?: { apiKey?: string } | string) {
    if (typeof options === "string") {
      this.apiKey = options;
    } else {
      this.apiKey = options?.apiKey || process.env.ASSEMBLYAI_API_KEY || "";
    }
  }

  /**
   * Uploads local audio buffer directly to AssemblyAI secure storage so AssemblyAI
   * has a guaranteed reachable URL even during development.
   */
  private async uploadAudioDirect(audioPathOrRef: string): Promise<string> {
    let audioBuffer: Buffer | null = null;

    // Check if audio exists in audio cache
    const cached = getCachedAudio(audioPathOrRef);
    if (cached) {
      audioBuffer = cached.buffer;
    } else {
      // Check if local file exists on disk
      const candidatePaths = [
        audioPathOrRef,
        path.join(process.cwd(), audioPathOrRef),
        path.join(process.cwd(), ".data", "audio", path.basename(audioPathOrRef)),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          audioBuffer = fs.readFileSync(p);
          break;
        }
      }
    }

    // Check if audio exists in Supabase Storage
    if (!audioBuffer && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseServerClient();
        if (supabase) {
          let cleanPath = audioPathOrRef;
          if (cleanPath.includes("?")) {
            try {
              const u = new URL(cleanPath, "http://localhost");
              cleanPath = u.searchParams.get("path") || cleanPath;
            } catch {
              // fallback
            }
          }
          const { data, error } = await supabase.storage
            .from(STORAGE_CONFIG.BUCKET_NAME)
            .download(cleanPath);
          if (!error && data) {
            const arrayBuf = await data.arrayBuffer();
            audioBuffer = Buffer.from(arrayBuf);
          }
        }
      } catch (dbErr) {
        console.warn("Failed to download audio from Supabase Storage for AssemblyAI upload:", dbErr);
      }
    }

    if (!audioBuffer) {
      throw new Error(`Cannot locate audio data to upload to AssemblyAI: ${audioPathOrRef}`);
    }

    const uploadRes = await fetch(`${this.baseUrl}/upload`, {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/octet-stream",
      },
      body: new Uint8Array(audioBuffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Direct audio upload to AssemblyAI failed (${uploadRes.status}): ${err}`);
    }

    const data = (await uploadRes.json()) as { upload_url: string };
    return data.upload_url;
  }

  /**
   * Submits pre-recorded audio URL to AssemblyAI with speaker diarization and telecom vocabulary.
   * Specification Sections 9 & 10.
   */
  async submit(request: TranscriptionRequest): Promise<TranscriptionSubmission> {
    if (!this.apiKey) {
      throw new Error("ASSEMBLYAI_API_KEY is required when TRANSCRIPTION_PROVIDER=assemblyai");
    }

    let audioUrl = request.audioUrl;

    // Ensure audio URL is genuinely reachable by AssemblyAI
    const isPublicHttpUrl =
      (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) &&
      !audioUrl.includes("localhost") &&
      !audioUrl.includes("127.0.0.1");

    if (isPublicHttpUrl) {
      // Verify external signed URL reachability (Status 200, audio content)
      try {
        const headRes = await fetch(audioUrl, { method: "HEAD" });
        if (headRes.status !== 200) {
          console.warn(`[AssemblyAI] HEAD check returned status ${headRes.status} for URL, uploading directly to AssemblyAI CDN.`);
          audioUrl = await this.uploadAudioDirect(audioUrl);
        }
      } catch {
        console.warn(`[AssemblyAI] Failed to verify external audio URL, uploading directly to AssemblyAI CDN.`);
        audioUrl = await this.uploadAudioDirect(audioUrl);
      }
    } else {
      // Local development URL, relative path, or file path -> upload directly to AssemblyAI CDN
      audioUrl = await this.uploadAudioDirect(audioUrl);
    }

    const speechModels = request.speechModels || ["universal-3-pro", "universal-2"];

    const payload: Record<string, unknown> = {
      audio_url: audioUrl,
      speech_models: speechModels,
      language_code: request.language || "en",
      speaker_labels: true,
      speakers_expected: 2,
      keyterms_prompt: request.keytermsPrompt || TELECOM_KEYTERMS,
      prompt: request.prompt || TELECOM_CONTEXT_PROMPT,
    };

    if (request.webhookUrl) {
      payload.webhook_url = request.webhookUrl;
      if (request.webhookAuthSecret) {
        payload.webhook_auth_header_name = "X-AssemblyAI-Webhook-Secret";
        payload.webhook_auth_header_value = request.webhookAuthSecret;
      }
    }

    const res = await fetch(`${this.baseUrl}/transcript`, {
      method: "POST",
      headers: {
        authorization: this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AssemblyAI submission failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { id: string; status: string };
    return {
      provider: this.name,
      providerTranscriptId: data.id,
      status: data.status === "processing" ? "PROCESSING" : "QUEUED",
      submittedAt: new Date().toISOString(),
      requestedSpeechModels: speechModels,
      sourceRecordingChecksum: request.sourceRecordingChecksum,
    };
  }

  /**
   * Retrieves full completed transcript, validates payload, and normalizes into internal types.
   */
  async getResult(providerTranscriptId: string): Promise<NormalizedTranscriptResult> {
    if (!this.apiKey) {
      throw new Error("ASSEMBLYAI_API_KEY is required when TRANSCRIPTION_PROVIDER=assemblyai");
    }

    const res = await fetch(`${this.baseUrl}/transcript/${providerTranscriptId}`, {
      method: "GET",
      headers: { authorization: this.apiKey },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch AssemblyAI transcript (${res.status}): ${errText}`);
    }

    const rawJson = await res.json();
    const parsed = AssemblyAITranscriptResponseSchema.parse(rawJson);

    if (parsed.status === "error") {
      throw new Error(`AssemblyAI returned error: ${parsed.error || "Unknown provider error"}`);
    }

    // Word-level speaker normalization (Specification Section 27 & 28)
    // When one speaker interrupts another, AssemblyAI can combine multiple speakers inside a single utterance.
    // Inspect speaker identity on individual words and normalize into separate internal segments.
    const utterances: NormalizedUtterance[] = [];
    let utteranceIndexCounter = 0;

    for (const u of parsed.utterances || []) {
      const words = u.words || [];
      const distinctSpeakers = Array.from(new Set(words.map((w) => w.speaker).filter(Boolean)));

      if (distinctSpeakers.length > 1) {
        // Multi-speaker segment inside single provider utterance - split by word speaker
        let currentSpeaker = words[0]?.speaker || u.speaker;
        let currentWords: typeof words = [];

        const flushSegment = () => {
          if (currentWords.length === 0) return;
          const segStart = Math.round(currentWords[0].start);
          const segEnd = Math.round(currentWords[currentWords.length - 1].end);
          const segText = currentWords.map((w) => w.text).join(" ").trim();
          const avgConf =
            currentWords.reduce((acc, w) => acc + (w.confidence ?? 0.95), 0) /
            currentWords.length;

          utterances.push({
            id: crypto.randomUUID(),
            utteranceIndex: utteranceIndexCounter++,
            speakerLabel: currentSpeaker,
            speakerRole: null,
            startMs: segStart,
            endMs: segEnd,
            text: segText,
            confidence: Number(avgConf.toFixed(4)),
            hasSpeakerOverlap: true,
            speakerAttributionConfidence: "MEDIUM",
            requiresSpeakerReview: true,
            words: currentWords.map((w) => ({
              text: w.text,
              startMs: Math.round(w.start),
              endMs: Math.round(w.end),
              confidence: Number((w.confidence ?? 0.95).toFixed(4)),
              speakerLabel: w.speaker || currentSpeaker,
            })),
          });
          currentWords = [];
        };

        for (const w of words) {
          const wSpeaker = w.speaker || u.speaker;
          if (wSpeaker !== currentSpeaker) {
            flushSegment();
            currentSpeaker = wSpeaker;
          }
          currentWords.push(w);
        }
        flushSegment();
      } else {
        // Pure single-speaker utterance
        utterances.push({
          id: crypto.randomUUID(),
          utteranceIndex: utteranceIndexCounter++,
          speakerLabel: u.speaker,
          speakerRole: null,
          startMs: Math.round(u.start),
          endMs: Math.round(u.end),
          text: u.text.trim(),
          confidence: Number((u.confidence ?? 0.95).toFixed(4)),
          hasSpeakerOverlap: false,
          speakerAttributionConfidence: "HIGH",
          requiresSpeakerReview: false,
          words: words.map((w) => ({
            text: w.text,
            startMs: Math.round(w.start),
            endMs: Math.round(w.end),
            confidence: Number((w.confidence ?? 0.95).toFixed(4)),
            speakerLabel: w.speaker || u.speaker,
          })),
        });
      }
    }

    const audioDurationMs = parsed.audio_duration ? Math.round(parsed.audio_duration * 1000) : 0;
    const confidence = parsed.confidence ? Number(parsed.confidence.toFixed(4)) : 0.95;

    // Check for empty transcript or language issue
    let requiresTranscriptReview = false;
    let transcriptReviewReason: string | null = null;

    if (utterances.length === 0 || !parsed.text || parsed.text.trim().length === 0) {
      requiresTranscriptReview = true;
      transcriptReviewReason = "EMPTY_TRANSCRIPT";
    } else if (confidence < 0.7) {
      requiresTranscriptReview = true;
      transcriptReviewReason = "LOW_CONFIDENCE";
    }

    const speechModelUsed = parsed.speech_model_used || "universal-3-pro";

    return {
      provider: this.name,
      providerTranscriptId: parsed.id,
      language: parsed.language_code || "en",
      confidence,
      audioDurationMs,
      fullText: parsed.text || "",
      utterances,
      requiresTranscriptReview,
      transcriptReviewReason,
      speechModelUsed,
      providerMetadata: {
        rawStatus: parsed.status,
        speechModelUsed,
      },
    };
  }

  /**
   * Checks current status of a transcription job on AssemblyAI.
   */
  async getStatus(providerTranscriptId: string): Promise<{ status: TranscriptionJobStatus; error?: string }> {
    if (!this.apiKey) {
      throw new Error("ASSEMBLYAI_API_KEY is required when TRANSCRIPTION_PROVIDER=assemblyai");
    }

    const res = await fetch(`${this.baseUrl}/transcript/${providerTranscriptId}`, {
      method: "GET",
      headers: { authorization: this.apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      return { status: "FAILED", error: `AssemblyAI API error: ${err}` };
    }

    const data = (await res.json()) as { status: string; error?: string };
    if (data.status === "completed") {
      return { status: "COMPLETED" };
    } else if (data.status === "error") {
      return { status: "FAILED", error: data.error || "AssemblyAI reported error" };
    } else if (data.status === "processing") {
      return { status: "PROCESSING" };
    }
    return { status: "QUEUED" };
  }
}
