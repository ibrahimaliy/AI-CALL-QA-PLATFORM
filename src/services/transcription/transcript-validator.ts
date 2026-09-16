import { NormalizedUtterance } from "@/lib/providers/transcription/types";
import crypto from "crypto";

export class TranscriptValidationError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.name = "TranscriptValidationError";
    this.code = code;
  }
}

/**
 * Computes canonical hash of utterances for structural fixture detection.
 * Section 16.
 */
export function computeUtterancesHash(utterances: NormalizedUtterance[]): string {
  const canonical = utterances.map((u) => ({
    speaker: u.speakerLabel,
    startMs: u.startMs,
    endMs: u.endMs,
    text: u.text.trim(),
  }));
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * Known mock fixture text patterns or structural fingerprints.
 */
export const KNOWN_MOCK_FIXTURE_HASHES = new Set<string>();

// Pre-calculate canonical hash of the standard 5-utterance mock fixture
const STANDARD_MOCK_FIXTURE: NormalizedUtterance[] = [
  {
    utteranceIndex: 0,
    speakerLabel: "A",
    startMs: 0,
    endMs: 5400,
    text: "Good morning, thank you for calling Smile Telecom. My name is Boluwatife. How may I assist you today?",
    confidence: 0.98,
  },
  {
    utteranceIndex: 1,
    speakerLabel: "B",
    startMs: 5800,
    endMs: 11200,
    text: "Hello Boluwatife. My internet connection has stopped working since this morning and I have an urgent meeting.",
    confidence: 0.96,
  },
  {
    utteranceIndex: 2,
    speakerLabel: "A",
    startMs: 11800,
    endMs: 17500,
    text: "I am truly sorry to hear that. For security and verification, may I please have your registered phone number and account name?",
    confidence: 0.97,
  },
  {
    utteranceIndex: 3,
    speakerLabel: "B",
    startMs: 18100,
    endMs: 22400,
    text: "Yes, the phone number is 07020209088 and the name on the account is Andrea Ayinde.",
    confidence: 0.99,
  },
  {
    utteranceIndex: 4,
    speakerLabel: "A",
    startMs: 23000,
    endMs: 27200,
    text: "Thank you for confirming. May I place you on a brief hold for about one minute while I check the router configuration?",
    confidence: 0.95,
  },
];
KNOWN_MOCK_FIXTURE_HASHES.add(computeUtterancesHash(STANDARD_MOCK_FIXTURE));

export interface TranscriptValidationInput {
  callId: string;
  expectedAudioDurationMs: number;
  providerAudioDurationMs: number;
  utterances: NormalizedUtterance[];
  fullText: string;
  provider: string;
  jobChecksum?: string | null;
  callChecksum?: string | null;
  allowMock?: boolean;
}

/**
 * Strict validator for completed transcripts.
 * Specification Sections 6, 11, 12, 14, 15, 16.
 */
export function validateTranscriptResult(input: TranscriptValidationInput): void {
  const {
    expectedAudioDurationMs,
    providerAudioDurationMs,
    utterances,
    fullText,
    provider,
    jobChecksum,
    callChecksum,
    allowMock,
  } = input;

  // 1. Mock Provider Verification (Section 1)
  const isMockProvider = provider === "MOCK_PROVIDER" || provider === "mock";
  if (isMockProvider && !allowMock) {
    throw new TranscriptValidationError(
      "UNEXPECTED_MOCK_PROVIDER",
      "Mock transcript provider was invoked when real provider was expected."
    );
  }

  // 2. Empty Transcript Check (Section 15)
  if (!fullText || fullText.trim().length === 0 || utterances.length === 0) {
    throw new TranscriptValidationError(
      "EMPTY_PROVIDER_TRANSCRIPT",
      "Provider returned an empty transcript with no utterances."
    );
  }

  // 3. Source Recording Checksum Binding (Section 6 & 7)
  if (jobChecksum && callChecksum && jobChecksum !== callChecksum) {
    throw new TranscriptValidationError(
      "TRANSCRIPT_SOURCE_MISMATCH",
      `Job checksum [${jobChecksum}] does not match call checksum [${callChecksum}].`
    );
  }

  // 4. Duration Validation (Section 11 & 14)
  if (expectedAudioDurationMs > 0 && providerAudioDurationMs > 0) {
    const durationRatio = providerAudioDurationMs / expectedAudioDurationMs;

    if (durationRatio < 0.8 || durationRatio > 1.2) {
      throw new TranscriptValidationError(
        "TRANSCRIPT_DURATION_MISMATCH",
        `Transcript duration (${Math.round(providerAudioDurationMs / 1000)}s) differs significantly from expected audio duration (${Math.round(
          expectedAudioDurationMs / 1000
        )}s). Duration ratio: ${durationRatio.toFixed(3)}.`
      );
    }
  }

  // 5. Content Sanity Checks (Section 12 & 15)
  // If audio is over 7 minutes (420,000 ms), but utterances <= 5 and transcript duration < 30,000 ms:
  if (expectedAudioDurationMs >= 420000) {
    if (providerAudioDurationMs < 30000 || utterances.length <= 5) {
      throw new TranscriptValidationError(
        "TRANSCRIPT_TOO_SHORT_FOR_RECORDING",
        `Recording duration is over 7 minutes (${Math.round(expectedAudioDurationMs / 1000)}s), but transcript only contains ${utterances.length} utterances spanning ${Math.round(
          providerAudioDurationMs / 1000
        )}s.`
      );
    }
  }

  // 6. Known Mock Fixture Detection (Section 16)
  const utteranceHash = computeUtterancesHash(utterances);
  if (KNOWN_MOCK_FIXTURE_HASHES.has(utteranceHash) && (!isMockProvider || !allowMock)) {
    throw new TranscriptValidationError(
      "KNOWN_MOCK_FIXTURE_DETECTED",
      "Detected known 5-utterance mock fixture in non-mock transcription context."
    );
  }

  // Also check if text matches the known mock keywords when non-mock
  if (!allowMock) {
    const lowerText = fullText.toLowerCase();
    if (
      lowerText.includes("boluwatife") &&
      lowerText.includes("andrea ayinde") &&
      lowerText.includes("router configuration")
    ) {
      throw new TranscriptValidationError(
        "KNOWN_MOCK_FIXTURE_DETECTED",
        "Detected known mock transcript text in non-mock transcription context."
      );
    }
  }
}
