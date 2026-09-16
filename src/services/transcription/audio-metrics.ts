import { NormalizedUtterance, CallAudioMetrics } from "@/lib/providers/transcription/types";

/**
 * Derives fundamental audio and conversational metrics directly from normalized utterances.
 * Specification Sections 51 & 52
 */
export function calculateBasicAudioMetrics(
  callId: string,
  utterances: NormalizedUtterance[],
  audioDurationMs?: number
): CallAudioMetrics {
  let agentUtteranceCount = 0;
  let customerUtteranceCount = 0;
  let agentWordCount = 0;
  let customerWordCount = 0;
  let totalSpeechMs = 0;
  let speakerTurnCount = 0;
  let lastSpeaker: string | null = null;

  for (const u of utterances) {
    const utteranceDuration = Math.max(0, u.endMs - u.startMs);
    totalSpeechMs += utteranceDuration;

    // Approximate words by splitting text if word-level array isn't populated
    const words = u.words?.length || u.text.trim().split(/\s+/).filter(Boolean).length;

    if (u.speakerRole === "AGENT") {
      agentUtteranceCount += 1;
      agentWordCount += words;
    } else if (u.speakerRole === "CUSTOMER") {
      customerUtteranceCount += 1;
      customerWordCount += words;
    }

    if (lastSpeaker !== null && lastSpeaker !== u.speakerLabel) {
      speakerTurnCount += 1;
    }
    lastSpeaker = u.speakerLabel;
  }

  const totalWords = agentWordCount + customerWordCount;
  const roughTalkRatio =
    totalWords > 0 ? Number(((agentWordCount / totalWords) * 100).toFixed(1)) : 50.0;

  const durationMin = (audioDurationMs || totalSpeechMs || 60000) / 60000;
  const roughSpeechRateWpm = durationMin > 0 ? Math.round(totalWords / durationMin) : 120;

  return {
    callId,
    speechDurationMs: totalSpeechMs,
    agentUtteranceCount,
    customerUtteranceCount,
    agentWordCount,
    customerWordCount,
    speakerTurnCount,
    roughTalkRatio,
    roughSpeechRateWpm,
  };
}
