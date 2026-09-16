import fs from "fs";
import path from "path";
import crypto from "crypto";

// Load .env.local into process.env
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").trim();
      process.env[key.trim()] = val;
    }
  }
}

import { getTranscriptionDiagnostics } from "../src/services/transcription/provider-factory";

const BASE_URL = "http://localhost:3000";
const AUDIO_PATH = path.join(process.cwd(), ".data", "audio", "c93641e7eebdb05719c44cdb0b279b8e548970da55c483e54aeec87188a1639a.bin");

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

async function main() {
  console.log("====================================================");
  console.log("EXECUTE FIRST REAL ASSEMBLYAI TRANSCRIPTION");
  console.log("====================================================");

  // 1. Runtime Diagnostics
  const diag = getTranscriptionDiagnostics();
  console.log("\n[DIAGNOSTICS]");
  console.log(`Configured Provider: ${diag.configuredProvider}`);
  console.log(`Mock Enabled: ${diag.mockEnabled}`);
  console.log(`API Key Configured: ${diag.apiKeyConfigured ? "yes" : "no"}`);
  console.log(`Webhook Configured: ${diag.webhookConfigured ? "yes" : "no"}`);
  console.log(`Webhook Public HTTPS: ${diag.webhookHttpsPublic ? "yes" : "no"}`);

  if (diag.configuredProvider !== "ASSEMBLYAI" || !diag.apiKeyConfigured) {
    throw new Error("Provider must be ASSEMBLYAI with a valid API key configured in .env.local.");
  }

  // 2. Audio File Verification
  console.log("\n[RECORDING VERIFICATION]");
  if (!fs.existsSync(AUDIO_PATH)) {
    throw new Error(`Audio file not found at: ${AUDIO_PATH}`);
  }
  const audioBuffer = fs.readFileSync(AUDIO_PATH);
  const actualChecksum = crypto.createHash("sha256").update(audioBuffer).digest("hex");
  const expectedChecksum = "d688d7d8f752a7002fc4dfb400480a3d19db0a9bb7dfb8a0ab1dfefbdf310303";

  console.log(`Audio File Size: ${audioBuffer.length} bytes (Expected: 6993324)`);
  console.log(`SHA-256 Checksum: ${actualChecksum}`);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`Recording checksum mismatch! Expected ${expectedChecksum}, got ${actualChecksum}`);
  }
  console.log("Audio file verified successfully.");

  // 3. Request Upload Intent for NEW clean call
  console.log("\n[STEP 1] Requesting Upload Intent for NEW Call...");
  const clientRequestId = `req_live_aai_${Date.now()}`;
  const intentRes = await fetch(`${BASE_URL}/api/calls/upload-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": "org-smile-nigeria-001",
      "x-user-role": "QA_AUDITOR",
      "x-user-id": "u-auditor-1",
    },
    body: JSON.stringify({
      agentId: "c0000000-0000-0000-0000-000000000001",
      campaignId: "b0000000-0000-0000-0000-000000000001",
      scorecardId: "d0000000-0000-0000-0000-000000000001",
      clientRequestId,
      fileName: "smile_real_7min_call_live.wav",
      fileSizeBytes: audioBuffer.length,
      mimeType: "audio/wav",
      interactionDate: "2026-09-15",
      interactionTime: "08:45:00",
      jiraTransactionNumber: "SMILE-NG-REAL-001",
      customerPhoneMasked: "+234***9088",
      issueType: "Network Data Drop",
      queryCount: 1,
    }),
  });

  const intentData = await intentRes.json();
  if (!intentRes.ok || !intentData.success) {
    throw new Error(`Upload intent failed: ${JSON.stringify(intentData)}`);
  }
  const callId = intentData.call.id;
  const uploadUrl = intentData.uploadAuthorization.uploadUrl;
  const storagePath = intentData.uploadAuthorization.storagePath;
  console.log(`Created NEW Call ID: ${callId}`);
  console.log(`Storage Path: ${storagePath}`);

  // 4. Direct Storage Upload
  console.log("\n[STEP 2] Uploading Audio to Storage Sink...");
  const uploadRes = await fetch(`http://localhost:3000${uploadUrl}`, {
    method: "PUT",
    headers: { "Content-Type": "audio/wav" },
    body: audioBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`Direct storage upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }
  console.log("Audio upload confirmed in storage sink.");

  // 5. Confirm Upload with Server-Side Identity Verification
  console.log("\n[STEP 3] Confirming Upload & Calculating Server-Side Identity...");
  const confirmRes = await fetch(`${BASE_URL}/api/calls/${callId}/upload-complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storagePath,
      fileSizeBytes: audioBuffer.length,
      recordingChecksum: expectedChecksum,
      durationSeconds: 437,
    }),
  });

  const confirmData = await confirmRes.json();
  if (!confirmRes.ok || !confirmData.success) {
    throw new Error(`Confirm upload failed: ${JSON.stringify(confirmData)}`);
  }
  console.log(`- Stored Checksum: ${confirmData.call.recording_checksum}`);
  console.log(`- Stored Size: ${confirmData.call.audio_size_bytes} bytes`);
  console.log(`- Stored Duration: ${confirmData.call.audio_duration_ms} ms (${formatMsToTime(confirmData.call.audio_duration_ms)})`);
  console.log(`- Status: ${confirmData.call.processing_status}`);

  // 6. Submit Real AssemblyAI Transcription Job
  console.log("\n[STEP 4] Submitting Real Job to AssemblyAI...");
  const transcribeRes = await fetch(`${BASE_URL}/api/calls/${callId}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      speakerMode: "AUTO",
    }),
  });

  const transcribeData = await transcribeRes.json();
  if (!transcribeRes.ok || !transcribeData.success) {
    throw new Error(`Transcription submission failed: ${JSON.stringify(transcribeData)}`);
  }

  const job = transcribeData.job;
  console.log(`Successfully submitted to AssemblyAI!`);
  console.log(`- Provider Job ID: ${job.provider_transcript_id}`);
  console.log(`- Provider Status: ${job.status}`);
  console.log(`- Source Recording Checksum: ${job.source_recording_checksum}`);

  // 7. Await Asynchronous AssemblyAI Processing
  console.log("\n[STEP 5] Waiting for AssemblyAI Transcription & Webhook / Status Sync...");
  console.log("(7-minute recording typically processes in 30-60 seconds on AssemblyAI)");

  let completed = false;
  let attempts = 0;
  const maxAttempts = 40; // 40 * 5s = 200 seconds max

  while (!completed && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;

    const statusRes = await fetch(`${BASE_URL}/api/calls/${callId}/transcribe`);
    const statusData = await statusRes.json();

    console.log(`[T+${attempts * 5}s] Call Status: ${statusData.status} | Completed: ${statusData.completed}`);

    if (statusData.completed || statusData.status === "TRANSCRIBED") {
      completed = true;
      break;
    }

    if (statusData.status === "FAILED") {
      throw new Error(`Transcription transitioned to FAILED state at provider.`);
    }
  }

  if (!completed) {
    throw new Error("Transcription timed out after waiting 200 seconds.");
  }

  console.log("\n[STEP 6] Transcription Completed & Validated Successfully!");

  // 8. Retrieve Full Transcript
  const transcriptRes = await fetch(`${BASE_URL}/api/calls/${callId}/transcript`);
  const transcriptData = await transcriptRes.json();

  if (!transcriptData.success || !transcriptData.transcript) {
    throw new Error(`Failed to load transcript: ${JSON.stringify(transcriptData)}`);
  }

  const tr = transcriptData.transcript;
  const utterances = transcriptData.utterances || [];

  console.log("\n====================================================");
  console.log("REAL TRANSCRIPTION RESULTS");
  console.log("====================================================");
  console.log(`Call ID: ${callId}`);
  console.log(`Provider: ${tr.provider}`);
  console.log(`Provider Job ID: ${tr.provider_transcript_id}`);
  console.log(`Speech Model Used: ${tr.speech_model_used || "universal-3-pro"}`);
  console.log(`Transcript Duration: ${tr.audio_duration_ms} ms (${formatMsToTime(tr.audio_duration_ms)})`);
  console.log(`Utterance Count: ${utterances.length}`);

  const uniqueSpeakers = Array.from(new Set(utterances.map((u: any) => u.speakerLabel)));
  console.log(`Speaker Labels: ${uniqueSpeakers.join(", ")}`);

  console.log("\n[FIRST 5 REAL UTTERANCES (PII MASKED)]");
  utterances.slice(0, 5).forEach((u: any, i: number) => {
    const idxStr = `U${(i + 1).toString().padStart(4, "0")}`;
    const startTime = formatMsToTime(u.startMs);
    const endTime = formatMsToTime(u.endMs);
    console.log(`\n${idxStr} | ${startTime} - ${endTime}`);
    console.log(`${u.speakerRole || "SPEAKER"} / Speaker ${u.speakerLabel}`);
    console.log(`"${maskPii(u.text)}"`);
  });

  console.log("\n====================================================");
  console.log(`CALL ID FOR VERIFICATION SCRIPT: ${callId}`);
  console.log("====================================================");

  return callId;
}

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});
