import { NextRequest } from "next/server";
import { GET as playbackGET } from "../src/app/api/audio/playback/route";
import { setCachedAudio, getCachedAudio } from "../src/lib/storage/audio-cache";
import { CallService } from "../src/services/calls/call.service";
import { TranscriptionService } from "../src/services/transcription/transcription.service";
import { StorageService } from "../src/lib/storage/storage.service";
import fs from "fs";
import path from "path";

async function runVerification() {
  console.log("=== Starting Automated Verification ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. Audio Cache & Playback Route Tests
  console.log("\n--- 1. Testing Audio Playback Route (HTTP 206 Range Requests) ---");
  const testPath = "test-recordings/sample-call.mp3";
  const dummyAudio = Buffer.alloc(1024, 0x55); // 1 KB dummy buffer
  setCachedAudio(testPath, dummyAudio, "audio/mpeg");

  const cached = getCachedAudio(testPath);
  assert(Boolean(cached && cached.buffer.length === 1024), "Audio cached successfully in memory/disk");

  // Generate signed playback URL
  const signed = await StorageService.generateSignedPlaybackUrl(testPath, 300);
  assert(Boolean(signed.signedUrl), "StorageService generated signed URL");

  const testUrl = new URL(signed.signedUrl, "http://localhost:3000");

  // Test 1.1: Missing token / path -> 401
  const reqNoParams = new NextRequest("http://localhost:3000/api/audio/playback");
  const resNoParams = await playbackGET(reqNoParams);
  assert(resNoParams.status === 401, "Missing query parameters returns HTTP 401");

  // Test 1.2: Invalid token -> 403
  const badTokenUrl = new URL(testUrl.toString());
  badTokenUrl.searchParams.set("token", "invalid-bad-token");
  const reqBadToken = new NextRequest(badTokenUrl.toString());
  const resBadToken = await playbackGET(reqBadToken);
  assert(resBadToken.status === 403, "Invalid signature token returns HTTP 403");

  // Test 1.3: Expired token -> 403
  const expiredUrl = new URL(testUrl.toString());
  expiredUrl.searchParams.set("expires", (Date.now() - 10000).toString());
  // recompute token for expired timestamp to test pure expiry
  const expTime = Date.now() - 10000;
  const expToken = Buffer.from(`${testPath}:${expTime}`).toString("base64url");
  expiredUrl.searchParams.set("token", expToken);
  expiredUrl.searchParams.set("expires", expTime.toString());
  const reqExpired = new NextRequest(expiredUrl.toString());
  const resExpired = await playbackGET(reqExpired);
  assert(resExpired.status === 403, "Expired token returns HTTP 403");

  // Test 1.4: Valid request without Range -> HTTP 200 full content
  const reqFull = new NextRequest(testUrl.toString());
  const resFull = await playbackGET(reqFull);
  const fullArrayBuf = await resFull.arrayBuffer();
  assert(resFull.status === 200, "Full audio request returns HTTP 200");
  assert(resFull.headers.get("Accept-Ranges") === "bytes", "Response includes Accept-Ranges: bytes");
  assert(resFull.headers.get("Content-Length") === "1024", "Full content length is 1024 bytes");
  assert(fullArrayBuf.byteLength === 1024, "Full audio body matches 1024 bytes");

  // Test 1.5: Valid Range request: bytes=0-49 (initial buffer) -> HTTP 206
  const reqRange1 = new NextRequest(testUrl.toString(), {
    headers: { Range: "bytes=0-49" },
  });
  const resRange1 = await playbackGET(reqRange1);
  const range1Buf = await resRange1.arrayBuffer();
  assert(resRange1.status === 206, "Range bytes=0-49 returns HTTP 206 Partial Content");
  assert(resRange1.headers.get("Content-Range") === "bytes 0-49/1024", "Content-Range is bytes 0-49/1024");
  assert(resRange1.headers.get("Content-Length") === "50", "Content-Length header is 50");
  assert(range1Buf.byteLength === 50, "Range payload buffer size is 50 bytes");

  // Test 1.6: Valid Range request: bytes=100-249 (scrubbing/seeking) -> HTTP 206
  const reqRange2 = new NextRequest(testUrl.toString(), {
    headers: { Range: "bytes=100-249" },
  });
  const resRange2 = await playbackGET(reqRange2);
  const range2Buf = await resRange2.arrayBuffer();
  assert(resRange2.status === 206, "Range bytes=100-249 returns HTTP 206 Partial Content");
  assert(resRange2.headers.get("Content-Range") === "bytes 100-249/1024", "Content-Range is bytes 100-249/1024");
  assert(range2Buf.byteLength === 150, "Range payload buffer size is 150 bytes");

  // Test 1.7: Out of bounds range: bytes=2000-3000 -> HTTP 416
  const reqRangeOOB = new NextRequest(testUrl.toString(), {
    headers: { Range: "bytes=2000-3000" },
  });
  const resRangeOOB = await playbackGET(reqRangeOOB);
  assert(resRangeOOB.status === 416, "Out of bounds Range returns HTTP 416 Range Not Satisfiable");
  assert(resRangeOOB.headers.get("Content-Range") === "bytes */1024", "HTTP 416 returns Content-Range: bytes */1024");

  // 2. CallService & Asynchronous Call Lookups
  console.log("\n--- 2. Testing CallService Asynchronous Retrieval ---");
  const nonExistent = await CallService.getCallRecord("00000000-0000-0000-0000-000000000000");
  assert(nonExistent === null, "CallService.getCallRecord safely returns null for unknown callId");

  const rawNonExistent = CallService.getRawCall("00000000-0000-0000-0000-000000000000");
  assert(rawNonExistent === undefined, "CallService.getRawCall safely returns undefined for unknown callId");

  // 3. Transcription Service Resilience
  console.log("\n--- 3. Testing Transcription Service Status Sync ---");
  try {
    await TranscriptionService.syncJobStatus("00000000-0000-0000-0000-000000000000");
    assert(false, "syncJobStatus should throw for non-existent call");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    assert(msg.includes("not found"), "syncJobStatus throws expected 'not found' message without TypeError");
  }

  // 4. Schema Migration & Enum Verification
  console.log("\n--- 4. Testing Migration Files & Schema Definitions ---");
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20260910000008_call_status_enum_extend.sql"
  );
  assert(fs.existsSync(migrationPath), "Migration 20260910000008_call_status_enum_extend.sql exists");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  assert(migrationSql.includes("UPLOADING"), "Migration includes UPLOADING status");
  assert(migrationSql.includes("PENDING_UPLOAD"), "Migration includes PENDING_UPLOAD status");
  assert(migrationSql.includes("CANCELLED"), "Migration includes CANCELLED status");

  console.log(`\n=== Verification Complete: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
