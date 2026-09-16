import { validateAudioFile, generateCallStoragePath, STORAGE_CONFIG } from "../src/lib/storage/config";
import { isValidStatusTransition, assertValidStatusTransition } from "../src/services/calls/state-machine";
import { AuthorizationService, UserAuthContext } from "../src/services/auth/authorization";
import { evaluateParameterEligibility } from "../src/services/auditing/source-evaluator";
import { CallService } from "../src/services/calls/call.service";
import { StorageService } from "../src/lib/storage/storage.service";
import { INITIAL_SCORECARD, INITIAL_AGENT, INITIAL_CAMPAIGN, INITIAL_ORGANIZATION } from "../src/lib/seed-data";
import { AppRole } from "../src/types/scorecard";

console.log("===============================================================");
console.log("AI CALL QA PLATFORM - PHASE 1.1 & PHASE 2 VERIFICATION SUITE");
console.log("===============================================================");

// 1. Audio File Validation Tests
console.log("\n[TEST 1] Audio File Type & Size Validation");
const validMp3 = validateAudioFile("support-call.mp3", "audio/mpeg", 15 * 1024 * 1024);
if (!validMp3.valid) throw new Error(`Valid MP3 rejected: ${validMp3.error}`);

const validWav = validateAudioFile("recording.wav", "audio/wav", 25 * 1024 * 1024);
if (!validWav.valid) throw new Error(`Valid WAV rejected: ${validWav.error}`);

const validM4a = validateAudioFile("call_audio.m4a", "audio/mp4", 10 * 1024 * 1024);
if (!validM4a.valid) throw new Error(`Valid M4A rejected: ${validM4a.error}`);

const zeroByte = validateAudioFile("empty.mp3", "audio/mpeg", 0);
if (zeroByte.valid) throw new Error("Zero byte file was unexpectedly allowed!");

const oversized = validateAudioFile("giant.mp3", "audio/mpeg", 60 * 1024 * 1024);
if (oversized.valid) throw new Error("Oversized file (60MB > 50MB) was unexpectedly allowed!");

const invalidExt = validateAudioFile("malicious.exe", "application/octet-stream", 1024);
if (invalidExt.valid) throw new Error("Invalid extension .exe was unexpectedly allowed!");

console.log("   -> PASS: Audio file validation correctly enforces format, MIME, and size limits.");

// 2. Storage Path Generation Test
console.log("\n[TEST 2] Private Storage Path Structure");
const path = generateCallStoragePath("org-123", "camp-456", "call-789", "customer call (1).mp3");
const expected = "org-123/camp-456/call-789/customer_call__1_.mp3";
if (path !== expected) {
  throw new Error(`Storage path mismatch! Expected '${expected}', got '${path}'`);
}
console.log(`   Generated: ${path}`);
console.log("   -> PASS: Structured private path matches organization/campaign/call hierarchy.");

// 3. State Machine Transitions Test
console.log("\n[TEST 3] Call State Machine Transitions");
if (!isValidStatusTransition("PENDING_UPLOAD", "UPLOADING")) throw new Error("PENDING_UPLOAD -> UPLOADING should be allowed");
if (!isValidStatusTransition("UPLOADING", "UPLOADED")) throw new Error("UPLOADING -> UPLOADED should be allowed");
if (!isValidStatusTransition("UPLOADING", "FAILED")) throw new Error("UPLOADING -> FAILED should be allowed");
if (!isValidStatusTransition("FAILED", "UPLOADING")) throw new Error("FAILED -> UPLOADING retry should be allowed");
if (isValidStatusTransition("COMPLETED", "UPLOADING")) throw new Error("COMPLETED -> UPLOADING must be strictly forbidden!");

let assertCaught = false;
try {
  assertValidStatusTransition("COMPLETED", "UPLOADING", "call-123");
} catch {
  assertCaught = true;
}
if (!assertCaught) throw new Error("assertValidStatusTransition failed to throw on forbidden transition");
console.log("   -> PASS: Centralized state machine properly permits and forbids status transitions.");

// 4. Idempotent Call Creation Test
console.log("\n[TEST 4] Duplicate Upload & Idempotency Protection");
async function testIdempotency() {
  const userCtx: UserAuthContext = {
    userId: "u-test-1",
    organizationId: INITIAL_ORGANIZATION.id,
    role: "QA_AUDITOR",
    fullName: "Andrea QA",
  };

  const idempotencyKey = `req_test_idempotent_${Date.now()}`;
  const input = {
    agentId: INITIAL_AGENT.id,
    campaignId: INITIAL_CAMPAIGN.id,
    scorecardId: INITIAL_SCORECARD.id,
    interactionDate: "2026-09-10",
    interactionTime: "10:00:00",
    issueType: "Billing Query",
    queryCount: 1,
    clientRequestId: idempotencyKey,
    fileName: "idempotent-test.mp3",
    fileSizeBytes: 2048500,
    mimeType: "audio/mpeg",
  };

  // First call
  const first = await CallService.createCallWithUploadIntent(input, userCtx);
  if (first.isExisting) throw new Error("First call creation unexpectedly marked as existing!");

  // Second call with same clientRequestId
  const second = await CallService.createCallWithUploadIntent(input, userCtx);
  if (!second.isExisting) throw new Error("Repeated call with same clientRequestId was not recognized as existing!");
  if (first.call.id !== second.call.id) {
    throw new Error(`Idempotency failed: Created different IDs [${first.call.id}] vs [${second.call.id}]`);
  }
  console.log(`   First call ID:  ${first.call.id}`);
  console.log(`   Second call ID: ${second.call.id} (Idempotently reused)`);
  console.log("   -> PASS: Idempotency protects against double-clicks and repeated requests.");
}

// 5. Audit Source Semantics (Phase 1.1 Requirement 4)
console.log("\n[TEST 5] Audit Source Semantics (Non-interchangeable Evidence)");
const transcriptOnlyEval = evaluateParameterEligibility(INITIAL_SCORECARD.parameters, ["TRANSCRIPT"]);
console.log(`   Auditable Weight with Transcript Only: ${transcriptOnlyEval.totalAuditableWeight} pts`);
console.log(`   Pending External Review: ${transcriptOnlyEval.totalUnAuditedWeight} pts`);

// Politeness (AUDIO), Enthusiasm (AUDIO), Comm (AUDIO), Listening (AUDIO), CRM (CRM) must be REVIEW_REQUIRED!
const audioParam = transcriptOnlyEval.eligibleParameters.find((p) => p.parameterName === "Politeness and Courtesy");
if (!audioParam || audioParam.isAuditable || audioParam.defaultResult !== "REVIEW_REQUIRED") {
  throw new Error("Politeness and Courtesy was incorrectly marked auditable with only transcript available!");
}

const greetingParam = transcriptOnlyEval.eligibleParameters.find((p) => p.parameterName === "Adherence to greeting/welcome verbiage");
if (!greetingParam || !greetingParam.isAuditable || greetingParam.defaultResult !== "PASS") {
  throw new Error("Greeting parameter was not marked auditable with transcript available!");
}
console.log("   -> PASS: Audio-dependent criteria are properly held for human review when audio evidence is absent.");

// 6. Role Authorization Matrix (Section 21)
console.log("\n[TEST 6] Role-Based Access Control (RBAC Matrix)");
const rolesCanUpload: AppRole[] = ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR"];
const rolesCannotUpload: AppRole[] = ["VIEWER", "AGENT"];

rolesCanUpload.forEach((r) => {
  if (!AuthorizationService.canUploadCall(r)) throw new Error(`Role ${r} should be allowed to upload calls`);
});

rolesCannotUpload.forEach((r) => {
  if (AuthorizationService.canUploadCall(r)) throw new Error(`Role ${r} should NOT be allowed to upload calls`);
});

if (AuthorizationService.canManageScorecards("VIEWER")) throw new Error("VIEWER should not manage scorecards");
if (AuthorizationService.canManageScorecards("SUPERVISOR")) throw new Error("SUPERVISOR should not manage scorecards (ADMIN/QA_MANAGER only)");
if (!AuthorizationService.canManageScorecards("ADMIN")) throw new Error("ADMIN should manage scorecards");
console.log("   -> PASS: Role authorization matrix strictly enforced.");

// 7. Multi-Tenant Organization Isolation
console.log("\n[TEST 7] Cross-Organization Isolation");
const userOrgA: UserAuthContext = {
  userId: "u-a",
  organizationId: "org-aaa",
  role: "ADMIN",
  fullName: "User A",
};

let crossOrgCaught = false;
try {
  AuthorizationService.assertOrgAccess(userOrgA, "org-bbb");
} catch (err: unknown) {
  crossOrgCaught = true;
}
if (!crossOrgCaught) throw new Error("Cross-organization access check failed to block access to different org!");
console.log("   -> PASS: Users cannot access records across organization boundaries.");

// 8. Signed Playback URL Generation
console.log("\n[TEST 8] Signed Playback URL Security");
async function testPlayback() {
  const playback = await StorageService.generateSignedPlaybackUrl("org/camp/call/audio.mp3", 900);
  if (!playback.signedUrl.includes("/api/audio/playback") || !playback.signedUrl.includes("token=")) {
    throw new Error(`Invalid signed playback URL format: ${playback.signedUrl}`);
  }
  console.log(`   Signed URL: ${playback.signedUrl}`);
  console.log(`   Expires At: ${playback.expiresAt}`);
  console.log("   -> PASS: Playback URL uses short-lived signed token.");
}

async function runAll() {
  await testIdempotency();
  await testPlayback();
  console.log("\n===============================================================");
  console.log("ALL PHASE 1.1 & PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  console.log("===============================================================");
}

runAll().catch((err) => {
  console.error("Test Suite Failure:", err);
  process.exit(1);
});
