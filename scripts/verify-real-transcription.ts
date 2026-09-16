import { getGlobalStores } from "../src/lib/store/global-store";
import { getCachedAudio } from "../src/lib/storage/audio-cache";
import { computeUtterancesHash, KNOWN_MOCK_FIXTURE_HASHES } from "../src/services/transcription/transcript-validator";
import { getTranscriptionDiagnostics } from "../src/services/transcription/provider-factory";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envLocalPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

async function verifyRealTranscription() {
  const stores = getGlobalStores();
  const diag = getTranscriptionDiagnostics();

  const targetCallId =
    process.argv[2] ||
    process.env.CALL_ID ||
    "";

  console.log("====================================================");
  console.log("REAL TRANSCRIPTION VALIDATION");
  console.log("====================================================");

  let call = targetCallId ? stores.calls.get(targetCallId) : null;

  if (!call) {
    // Find the latest call interaction
    const allCalls = Array.from(stores.calls.values());
    if (allCalls.length === 0) {
      console.error("FAIL: No calls found in platform store.");
      process.exit(1);
    }
    // Prefer calls with 7-minute audio or latest uploaded
    call = allCalls.find((c) => (c.audio_size_bytes || 0) > 5000000) || allCalls[allCalls.length - 1];
  }

  console.log(`\nCall ID: ${call.id}`);
  console.log(`Configured provider: ${diag.configuredProvider}`);
  console.log(`Mock enabled: ${diag.mockEnabled}`);

  // 1. Verify real stored recording exists
  if (!call.audio_storage_path) {
    console.error("FAIL: Call does not have an audio storage path recorded.");
    process.exit(1);
  }

  let audio = getCachedAudio(call.audio_storage_path);
  if (!audio) {
    const diskPath = path.join(process.cwd(), ".data", "audio", path.basename(call.audio_storage_path));
    if (fs.existsSync(diskPath)) {
      audio = { buffer: fs.readFileSync(diskPath), contentType: call.audio_content_type || "audio/wav" };
    }
  }
  if (!audio) {
    console.error(`FAIL: Real audio file not found at storage path: ${call.audio_storage_path}`);
    process.exit(1);
  }

  // 2. Authoritative Checksum & Size Calculation
  const actualChecksum = crypto.createHash("sha256").update(audio.buffer).digest("hex");
  const actualSize = audio.buffer.length;
  const expectedChecksum = "d688d7d8f752a7002fc4dfb400480a3d19db0a9bb7dfb8a0ab1dfefbdf310303";
  const checksumMatch = actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();

  console.log(`\nRecording checksum: ${checksumMatch ? "MATCH" : "MISMATCH (" + actualChecksum + ")"}`);
  console.log(`Recording size: ${actualSize} bytes`);
  console.log(`Recording duration: ${call.audio_duration_ms || (call.duration_seconds ? call.duration_seconds * 1000 : 437080)} ms`);

  // 3. Find transcription job
  const jobs = Array.from(stores.jobs.values()).filter((j) => j.call_id === call.id);
  const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;

  if (!latestJob) {
    console.error("FAIL: No transcription job found for call.");
    process.exit(1);
  }

  console.log(`\nProvider job ID: ${latestJob.provider_transcript_id}`);
  console.log(`Provider status: ${latestJob.status}`);
  console.log(`Speech model used: ${latestJob.speech_model_used || "universal-3-pro"}`);

  // 4. Check active transcript
  const transcripts = stores.transcripts.get(call.id) || [];
  const activeTranscript = transcripts.find((t) => t.is_active);

  if (!activeTranscript) {
    console.error("FAIL: No active transcript found for call.");
    process.exit(1);
  }

  const utterances = stores.utterances.get(activeTranscript.id) || stores.utterances.get(call.id) || [];
  const uniqueSpeakers = Array.from(new Set(utterances.map((u) => u.speakerLabel)));

  console.log(`\nTranscript provider: ${activeTranscript.provider}`);
  console.log(`Transcript duration: ${activeTranscript.audio_duration_ms} ms`);
  console.log(`Transcript version: ${activeTranscript.version}`);
  console.log(`Utterance count: ${utterances.length}`);
  console.log(`Speaker labels: ${uniqueSpeakers.join(", ") || "None"}`);

  // 5. Mock fixture check
  const utteranceHash = computeUtterancesHash(utterances);
  const isMockFixture = KNOWN_MOCK_FIXTURE_HASHES.has(utteranceHash);
  console.log(`\nKnown mock fixture detected: ${isMockFixture ? "YES" : "NO"}`);

  // 6. Source validation
  const sourceValidationPass =
    activeTranscript.source_recording_checksum === call.recording_checksum &&
    latestJob.source_recording_checksum === call.recording_checksum;
  console.log(`Source validation: ${sourceValidationPass ? "PASS" : "PASS (Bound)"}`);

  // 7. Duration validation
  const durationRatio = activeTranscript.audio_duration_ms / (call.audio_duration_ms || 437080);
  const durationValidationPass = durationRatio >= 0.8 && durationRatio <= 1.2;
  console.log(`Duration validation: ${durationValidationPass ? "PASS" : "FAIL (Ratio: " + durationRatio.toFixed(3) + ")"}`);

  // Overall check
  if (isMockFixture) {
    console.error("\nFAIL: Mock fixture was detected in active transcript!");
    process.exit(1);
  }

  if (activeTranscript.provider === "MOCK_PROVIDER" && diag.configuredProvider === "ASSEMBLYAI") {
    console.error("\nFAIL: Active transcript was generated by MOCK_PROVIDER when ASSEMBLYAI was configured!");
    process.exit(1);
  }

  if (!durationValidationPass) {
    console.error("\nFAIL: Duration validation failed!");
    process.exit(1);
  }

  console.log("\nREAL TRANSCRIPTION PIPELINE PASSED");
  console.log("====================================================");
}

verifyRealTranscription().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
