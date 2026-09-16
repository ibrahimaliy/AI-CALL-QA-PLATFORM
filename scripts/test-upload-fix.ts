import fs from "fs";
import path from "path";
import crypto from "crypto";

async function main() {
  const audioPath = path.join(process.cwd(), ".data", "audio", "c93641e7eebdb05719c44cdb0b279b8e548970da55c483e54aeec87188a1639a.bin");
  const audioBuffer = fs.readFileSync(audioPath);
  const realChecksum = crypto.createHash("sha256").update(audioBuffer).digest("hex");

  console.log("Testing upload-intent...");
  const intentRes = await fetch("http://localhost:3000/api/calls/upload-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "c0000000-0000-0000-0000-000000000001",
      campaignId: "b0000000-0000-0000-0000-000000000001",
      scorecardId: "d0000000-0000-0000-0000-000000000001",
      clientRequestId: "test_ui_fix_" + Date.now(),
      fileName: "test_real_call.wav",
      fileSizeBytes: audioBuffer.length,
      mimeType: "audio/wav",
      interactionDate: "2026-09-15",
      interactionTime: "09:30:00",
      jiraTransactionNumber: "TEST-002",
      customerPhoneMasked: "+234***9088",
      issueType: "Network",
      queryCount: 1,
    }),
  });

  const intentData = await intentRes.json();
  if (!intentData.success) throw new Error("Intent failed: " + JSON.stringify(intentData));
  const { call, uploadAuthorization } = intentData;
  console.log("Call created:", call.id);

  console.log("Testing direct storage upload...");
  const uploadRes = await fetch("http://localhost:3000" + uploadAuthorization.uploadUrl, {
    method: "PUT",
    headers: uploadAuthorization.uploadHeaders,
    body: audioBuffer,
  });
  if (!uploadRes.ok) throw new Error("Upload failed: " + uploadRes.status);
  console.log("Upload succeeded.");

  console.log("Testing upload-complete with real SHA-256...");
  const completeRes = await fetch("http://localhost:3000/api/calls/" + call.id + "/upload-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storagePath: uploadAuthorization.storagePath,
      fileSizeBytes: audioBuffer.length,
      recordingChecksum: realChecksum,
      durationSeconds: null,
    }),
  });

  const completeData = await completeRes.json();
  if (!completeData.success) throw new Error("Upload complete failed: " + JSON.stringify(completeData));
  console.log("Upload complete verified successfully! Processing status:", completeData.call.processing_status);
  console.log("Authoritative checksum:", completeData.call.recording_checksum);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
