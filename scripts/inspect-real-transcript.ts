import { getGlobalStores } from "../src/lib/store/global-store";

function maskPii(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b/g, "$1***@$2")
    .replace(/(\+?234|0)([789][01]\d)\d{4}(\d{3})/g, "$1$2****$3")
    .replace(/\b(\d{3})\d{4}(\d{3,4})\b/g, "$1****$2")
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?(\d{4})\b/g, "****-****-****-$1");
}

function formatMsToTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const stores = getGlobalStores();
const callId = process.argv[2] || "cf96f296-a03d-4f9a-b9c4-1f1ff466011d";
const call = stores.calls.get(callId);
const transcripts = stores.transcripts.get(callId) || [];
const active = transcripts.find((t) => t.is_active);
const jobs = Array.from(stores.jobs.values()).filter((j) => j.call_id === callId);
const job = jobs[jobs.length - 1];

console.log("====================================================");
console.log("FIRST REAL TRANSCRIPTION AUDIT REPORT");
console.log("====================================================");
console.log(`Call ID:                  ${callId}`);
console.log(`Processing Status:        ${call?.processing_status}`);
console.log(`Provider:                 ${active?.provider}`);
console.log(`Provider Job ID:          ${active?.provider_transcript_id}`);
console.log(`Speech Model Used:        ${active?.speech_model_used}`);
console.log(`Audio Duration (ms):      ${active?.audio_duration_ms} (${formatMsToTime(active?.audio_duration_ms || 0)})`);
console.log(`Language:                 ${active?.language}`);
console.log(`Overall Confidence:       ${((active?.confidence || 0) * 100).toFixed(1)}%`);
console.log(`Requires Speaker Review:  ${active?.requires_speaker_review}`);
console.log(`Requires Transcript Rev:  ${active?.requires_transcript_review}`);
console.log(`Review Reason:            ${active?.transcript_review_reason || "None"}`);
console.log(`Recording Checksum:       ${active?.source_recording_checksum}`);
console.log(`Job Status:               ${job?.status}`);
console.log(`Job Submitted At:         ${job?.submitted_at}`);
console.log(`Job Completed At:         ${job?.completed_at}`);

const utterances = active ? (stores.utterances.get(active.id) || []) : [];
console.log(`Total Utterances:         ${utterances.length}`);

const uniqueSpeakers = Array.from(new Set(utterances.map((u) => u.speakerLabel)));
console.log(`Distinct Speakers:        ${uniqueSpeakers.join(", ")}`);

console.log("\n----------------------------------------------------");
console.log("FIRST 5 REAL UTTERANCES (PII MASKED)");
console.log("----------------------------------------------------");
utterances.slice(0, 5).forEach((u, i) => {
  const num = (i + 1).toString().padStart(2, "0");
  const time = `${formatMsToTime(u.startMs)} - ${formatMsToTime(u.endMs)}`;
  console.log(`[Utterance ${num}] [${time}] Speaker ${u.speakerLabel} (${u.speakerRole}):`);
  console.log(`"${maskPii(u.text)}"`);
  console.log(`(Confidence: ${((u.confidence || 0) * 100).toFixed(1)}%)\n`);
});

console.log("----------------------------------------------------");
console.log("NEXT 5 UTTERANCES (FOR CONTEXT)");
console.log("----------------------------------------------------");
utterances.slice(5, 10).forEach((u, i) => {
  const num = (i + 6).toString().padStart(2, "0");
  const time = `${formatMsToTime(u.startMs)} - ${formatMsToTime(u.endMs)}`;
  console.log(`[Utterance ${num}] [${time}] Speaker ${u.speakerLabel} (${u.speakerRole}):`);
  console.log(`"${maskPii(u.text)}"`);
  console.log(`(Confidence: ${((u.confidence || 0) * 100).toFixed(1)}%)\n`);
});
