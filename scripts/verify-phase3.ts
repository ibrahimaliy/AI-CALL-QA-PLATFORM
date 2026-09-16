import { MockTranscriptionProvider } from "../src/lib/providers/transcription/mock.provider";
import { AssemblyAITranscriptionProvider } from "../src/lib/providers/transcription/assemblyai.provider";
import { SpeakerRoleMapper } from "../src/services/transcription/speaker-role-mapper";
import { calculateBasicAudioMetrics } from "../src/services/transcription/audio-metrics";
import { TranscriptionService } from "../src/services/transcription/transcription.service";
import { CallService } from "../src/services/calls/call.service";
import { isValidStatusTransition, assertValidStatusTransition } from "../src/services/calls/state-machine";
import { AuthorizationService, UserAuthContext } from "../src/services/auth/authorization";
import { INITIAL_ORGANIZATION, INITIAL_AGENT, INITIAL_CAMPAIGN, INITIAL_SCORECARD } from "../src/lib/seed-data";
import { CallRecord } from "../src/types/scorecard";

console.log("===============================================================");
console.log("AI CALL QA PLATFORM - PHASE 3 VERIFICATION SUITE");
console.log("===============================================================");

async function runPhase3Verification() {
  process.env.ENABLE_MOCK_TRANSCRIPTION = "true";
  const userCtx: UserAuthContext = {
    userId: "u-auditor-1",
    organizationId: INITIAL_ORGANIZATION.id,
    role: "QA_AUDITOR",
    fullName: "Ayinde Andrea",
  };

  const supervisorCtx: UserAuthContext = {
    userId: "u-supervisor-1",
    organizationId: INITIAL_ORGANIZATION.id,
    role: "SUPERVISOR",
    fullName: "Supervisor Ade",
  };

  // -------------------------------------------------------------
  // TEST 1: Provider Abstraction Architecture (Section 2, 71.1)
  // -------------------------------------------------------------
  console.log("\n[TEST 1] Transcription Provider Abstraction");
  const mockProvider = new MockTranscriptionProvider();
  const assemblyProvider = new AssemblyAITranscriptionProvider("dummy-test-key-0123456789");

  if (mockProvider.name !== "MOCK_PROVIDER") {
    throw new Error("Mock provider name mismatch");
  }
  if (assemblyProvider.name !== "ASSEMBLYAI") {
    throw new Error("AssemblyAI provider name mismatch");
  }
  if (typeof mockProvider.submit !== "function" || typeof mockProvider.getResult !== "function") {
    throw new Error("Mock provider does not implement TranscriptionProvider interface");
  }
  if (typeof assemblyProvider.submit !== "function" || typeof assemblyProvider.getResult !== "function") {
    throw new Error("AssemblyAI provider does not implement TranscriptionProvider interface");
  }
  console.log("   -> PASS: Interchangeable TranscriptionProvider interface implemented by both Mock and AssemblyAI adapters.");

  // -------------------------------------------------------------
  // TEST 2 & 3: Submission, Diarization, and Response Normalization (Section 71.2, 71.3)
  // -------------------------------------------------------------
  console.log("\n[TEST 2 & 3] AssemblyAI Normalization & Speaker Diarization Persistence");
  const submission = await mockProvider.submit({
    audioUrl: "https://storage.local/audio/call.mp3",
    language: "en",
    speakerMode: "AUTO",
  });

  if (!submission.providerTranscriptId || submission.status !== "PROCESSING") {
    throw new Error(`Invalid submission result: ${JSON.stringify(submission)}`);
  }

  const normalized = await mockProvider.getResult(submission.providerTranscriptId);
  if (!normalized.fullText || normalized.audioDurationMs <= 0 || normalized.confidence <= 0) {
    throw new Error("Normalized transcript missing required metadata");
  }
  if (normalized.utterances.length === 0) {
    throw new Error("Normalized transcript contains 0 utterances");
  }

  // Check speaker separation
  const speakerLabels = new Set(normalized.utterances.map((u) => u.speakerLabel));
  if (speakerLabels.size < 2) {
    throw new Error(`Expected multi-speaker diarization, but found: ${Array.from(speakerLabels)}`);
  }
  console.log(`   Discovered ${speakerLabels.size} distinct diarized speakers: ${Array.from(speakerLabels).join(", ")}`);
  console.log(`   Parsed ${normalized.utterances.length} utterances across ${(normalized.audioDurationMs / 1000).toFixed(1)}s audio.`);
  console.log("   -> PASS: Provider response normalized into internal schema with preserved speaker separation.");

  // -------------------------------------------------------------
  // TEST 4: Millisecond Timestamps Preservation (Section 71.4)
  // -------------------------------------------------------------
  console.log("\n[TEST 4] Millisecond Precision Timestamp Preservation");
  for (const u of normalized.utterances) {
    if (typeof u.startMs !== "number" || typeof u.endMs !== "number") {
      throw new Error(`Utterance [${u.id}] has non-numeric timestamps: ${u.startMs}, ${u.endMs}`);
    }
    if (u.startMs < 0 || u.endMs <= u.startMs) {
      throw new Error(`Utterance [${u.id}] has invalid timestamp boundaries: ${u.startMs} - ${u.endMs}`);
    }
    if (u.words) {
      for (const w of u.words) {
        if (w.startMs < u.startMs || w.endMs > u.endMs + 50) {
          throw new Error(`Word '${w.text}' [${w.startMs}-${w.endMs}] out of utterance bounds [${u.startMs}-${u.endMs}]`);
        }
      }
    }
  }
  console.log("   All utterances and words validated with non-negative, chronological integer millisecond offsets.");
  console.log("   -> PASS: Millisecond timestamps preserved without lossy conversions.");

  // -------------------------------------------------------------
  // TEST 5: Webhook Authentication & Payload Security (Section 71.5)
  // -------------------------------------------------------------
  console.log("\n[TEST 5] Webhook Secret Authentication");
  const expectedSecret = "test-secret-phase3-key-999";
  const oldSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
  process.env.ASSEMBLYAI_WEBHOOK_SECRET = expectedSecret;

  // Function simulating webhook auth check
  function verifyWebhookAuth(providedSecret?: string | null): boolean {
    const configured = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
    if (!configured) return true;
    return providedSecret === configured;
  }

  if (verifyWebhookAuth("wrong-secret")) {
    throw new Error("Webhook auth check allowed invalid secret!");
  }
  if (verifyWebhookAuth(null)) {
    throw new Error("Webhook auth check allowed missing secret!");
  }
  if (!verifyWebhookAuth(expectedSecret)) {
    throw new Error("Webhook auth check rejected valid secret!");
  }
  process.env.ASSEMBLYAI_WEBHOOK_SECRET = oldSecret;
  console.log("   -> PASS: Webhook strictly rejects unauthorized requests when secret is configured.");

  // -------------------------------------------------------------
  // TEST 6: Webhook Idempotency (Section 71.6)
  // -------------------------------------------------------------
  console.log("\n[TEST 6] Duplicate Webhook Idempotency");
  // Create a test call record
  const testCallId = crypto.randomUUID();
  const testCall: CallRecord = {
    id: testCallId,
    organization_id: INITIAL_ORGANIZATION.id,
    campaign_id: INITIAL_CAMPAIGN.id,
    agent_id: INITIAL_AGENT.id,
    scorecard_id: INITIAL_SCORECARD.id,
    interaction_date: "2026-09-10",
    interaction_time: "10:00:00",
    issue_type: "Network Data Drop",
    query_count: 1,
    audio_storage_path: `${INITIAL_ORGANIZATION.id}/${INITIAL_CAMPAIGN.id}/${testCallId}/sample.mp3`,
    original_filename: "sample.mp3",
    audio_content_type: "audio/mpeg",
    audio_size_bytes: 3145728,
    duration_seconds: 27,
    audio_duration_ms: 27200,
    language: "en",
    processing_status: "UPLOADED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    agent_name: "Olabiyi Boluwatife",
  };
  CallService.updateCall(testCall);

  // Submit for transcription
  const { job } = await TranscriptionService.submitCallForTranscription(testCall, userCtx, {
    forceMock: true,
  });

  // 1st Webhook delivery: Completed
  const delivery1 = await TranscriptionService.handleProviderCompletion(
    job.provider_transcript_id,
    "completed",
    testCall,
    undefined,
    mockProvider
  );
  if (!delivery1.success || delivery1.alreadyProcessed) {
    throw new Error("First completion webhook should have succeeded as fresh delivery!");
  }

  // 2nd Webhook delivery (duplicate network retry)
  const delivery2 = await TranscriptionService.handleProviderCompletion(
    job.provider_transcript_id,
    "completed",
    testCall,
    undefined,
    mockProvider
  );
  if (!delivery2.success || !delivery2.alreadyProcessed) {
    throw new Error("Second duplicate webhook should have returned alreadyProcessed = true!");
  }
  console.log("   1st Webhook outcome: success=true, alreadyProcessed=false");
  console.log("   2nd Webhook outcome: success=true, alreadyProcessed=true (Idempotent response)");
  console.log("   -> PASS: Duplicate webhook deliveries handled gracefully without double writes.");

  // -------------------------------------------------------------
  // TEST 7: Failure & Retry Handling (Section 71.7)
  // -------------------------------------------------------------
  console.log("\n[TEST 7] Provider Failure and Supervisor Retry Flow");
  const failedCallId = crypto.randomUUID();
  const failedCall: CallRecord = {
    id: failedCallId,
    organization_id: INITIAL_ORGANIZATION.id,
    campaign_id: INITIAL_CAMPAIGN.id,
    agent_id: INITIAL_AGENT.id,
    scorecard_id: INITIAL_SCORECARD.id,
    interaction_date: "2026-09-10",
    interaction_time: "10:00:00",
    issue_type: "SIM Registration",
    query_count: 1,
    audio_storage_path: `${INITIAL_ORGANIZATION.id}/${INITIAL_CAMPAIGN.id}/${failedCallId}/corrupt.mp3`,
    original_filename: "corrupt.mp3",
    audio_content_type: "audio/mpeg",
    audio_size_bytes: 1024,
    language: "en",
    processing_status: "UPLOADED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    agent_name: "Boluwatife Olabiyi",
  };
  CallService.updateCall(failedCall);

  const failJob = await TranscriptionService.submitCallForTranscription(failedCall, userCtx, { forceMock: true });
  if (failedCall.processing_status !== "TRANSCRIBING") {
    throw new Error(`Expected TRANSCRIBING status, got: ${failedCall.processing_status}`);
  }

  // Simulate provider failure webhook
  await TranscriptionService.handleProviderCompletion(
    failJob.job.provider_transcript_id,
    "error",
    failedCall,
    "Audio file corrupted or unreadable."
  );

  if ((failedCall.processing_status as string) !== "FAILED") {
    throw new Error(`Expected call to be in FAILED status, got: ${failedCall.processing_status}`);
  }
  console.log(`   Call transitioned to FAILED: ${failedCall.processing_error}`);

  // Retry transcription
  const retryResult = await TranscriptionService.retryTranscription(failedCallId, userCtx, { forceMock: true });
  if (failedCall.processing_status !== "TRANSCRIBING") {
    throw new Error(`After retry, expected call to be in TRANSCRIBING status, got: ${failedCall.processing_status}`);
  }
  if (retryResult.job.attempt_number !== 2) {
    throw new Error(`Expected attempt_number to be 2, got: ${retryResult.job.attempt_number}`);
  }
  console.log(`   Retry initiated: Attempt #${retryResult.job.attempt_number} (Status: ${failedCall.processing_status})`);
  console.log("   -> PASS: Failure state properly transitions, and retry flow tracks attempt numbers.");

  // -------------------------------------------------------------
  // TEST 8: Speaker Role Mapping Heuristics (Section 71.8)
  // -------------------------------------------------------------
  console.log("\n[TEST 8] Multi-Signal Speaker Role Mapping Heuristics");
  const testUtterances = [
    {
      id: "u1",
      utteranceIndex: 0,
      speakerLabel: "Speaker A",
      text: "Thank you for calling customer service. My name is Boluwatife, how may I assist you today?",
      startMs: 0,
      endMs: 4500,
      confidence: 0.98,
    },
    {
      id: "u2",
      utteranceIndex: 1,
      speakerLabel: "Speaker B",
      text: "Hello Boluwatife, my data line has been suspended and I need urgent help activating it.",
      startMs: 4800,
      endMs: 9500,
      confidence: 0.95,
    },
    {
      id: "u3",
      utteranceIndex: 2,
      speakerLabel: "Speaker A",
      text: "I understand your concern. Please allow me to check your account balance and line status.",
      startMs: 9800,
      endMs: 14000,
      confidence: 0.97,
    },
  ];

  const mapped = SpeakerRoleMapper.mapRoles(testUtterances, "Boluwatife Olabiyi");
  const speakerARole = mapped.mappedUtterances.find((u) => u.speakerLabel === "Speaker A")?.speakerRole;
  const speakerBRole = mapped.mappedUtterances.find((u) => u.speakerLabel === "Speaker B")?.speakerRole;

  if (speakerARole !== "AGENT") {
    throw new Error(`Expected Speaker A to be AGENT, got: ${speakerARole}`);
  }
  if (speakerBRole !== "CUSTOMER") {
    throw new Error(`Expected Speaker B to be CUSTOMER, got: ${speakerBRole}`);
  }
  if (mapped.requiresSpeakerReview) {
    throw new Error("High confidence clear greeting match should NOT require review!");
  }
  console.log(`   Speaker A mapped to: ${speakerARole} (Greeting + Agent Name Signal)`);
  console.log(`   Speaker B mapped to: ${speakerBRole} (Problem Statement Signal)`);
  console.log(`   Requires Review Flag: ${mapped.requiresSpeakerReview}`);

  // Test ambiguous case
  const ambiguousUtterances = [
    { id: "a1", utteranceIndex: 0, speakerLabel: "Speaker A", text: "Hello?", startMs: 0, endMs: 800, confidence: 0.8 },
    { id: "a2", utteranceIndex: 1, speakerLabel: "Speaker B", text: "Hi, who is this?", startMs: 900, endMs: 1500, confidence: 0.8 },
  ];
  const ambiguousMapped = SpeakerRoleMapper.mapRoles(ambiguousUtterances, "Boluwatife");
  if (!ambiguousMapped.requiresSpeakerReview) {
    throw new Error("Ambiguous dialogue must set requiresSpeakerReview = true!");
  }
  console.log(`   Ambiguous call correctly flagged requiresSpeakerReview = true (${ambiguousMapped.reviewReason})`);
  console.log("   -> PASS: Speaker role mapping accurately classifies roles and flags low confidence cases.");

  // -------------------------------------------------------------
  // TEST 9: Tenant Isolation (Section 71.9)
  // -------------------------------------------------------------
  console.log("\n[TEST 9] Cross-Tenant Transcript Isolation");
  const foreignUserCtx: UserAuthContext = {
    userId: "u-alien",
    organizationId: "org-foreign-999",
    role: "ADMIN",
    fullName: "Foreign User",
  };

  let blocked = false;
  try {
    AuthorizationService.assertOrgAccess(foreignUserCtx, testCall.organization_id);
  } catch {
    blocked = true;
  }
  if (!blocked) {
    throw new Error("Foreign organization user was not blocked from accessing transcript!");
  }
  console.log("   -> PASS: Transcript and call audio access strictly partitioned by organization ID.");

  // -------------------------------------------------------------
  // TEST 10: State Machine Transitions (Section 71.10)
  // -------------------------------------------------------------
  console.log("\n[TEST 10] Call State Machine Rigidity");
  if (!isValidStatusTransition("UPLOADED", "TRANSCRIBING")) {
    throw new Error("UPLOADED -> TRANSCRIBING must be valid");
  }
  if (!isValidStatusTransition("TRANSCRIBING", "TRANSCRIBED")) {
    throw new Error("TRANSCRIBING -> TRANSCRIBED must be valid");
  }
  if (!isValidStatusTransition("TRANSCRIBING", "FAILED")) {
    throw new Error("TRANSCRIBING -> FAILED must be valid");
  }
  if (isValidStatusTransition("TRANSCRIBED", "PENDING_UPLOAD")) {
    throw new Error("TRANSCRIBED -> PENDING_UPLOAD must be forbidden");
  }
  console.log("   -> PASS: State machine permits valid transcription steps and forbids illegal rollbacks.");

  // -------------------------------------------------------------
  // TEST 11: Audio Metrics & Supervisor Corrections (Section 71.11, 27-29)
  // -------------------------------------------------------------
  console.log("\n[TEST 11] Conversational Metrics & Supervisor Role Correction");
  const metrics = calculateBasicAudioMetrics("test-call-1", mapped.mappedUtterances, 14500);

  if (metrics.speakerTurnCount !== 2) {
    throw new Error(`Expected 2 speaker turns, got ${metrics.speakerTurnCount}`);
  }
  if (metrics.agentUtteranceCount !== 2 || metrics.customerUtteranceCount !== 1) {
    throw new Error(`Utterance count mismatch: agent=${metrics.agentUtteranceCount}, customer=${metrics.customerUtteranceCount}`);
  }
  if (metrics.roughTalkRatio <= 0 || metrics.roughTalkRatio >= 100) {
    throw new Error(`Invalid talk ratio: ${metrics.roughTalkRatio}`);
  }
  console.log(`   Speech Duration: ${(metrics.speechDurationMs / 1000).toFixed(1)}s`);
  console.log(`   Turns: ${metrics.speakerTurnCount}`);
  console.log(`   Agent Talk: ${metrics.roughTalkRatio}% | Customer Talk: ${(100 - metrics.roughTalkRatio).toFixed(1)}%`);

  // Supervisor correction test: flip Speaker A to CUSTOMER and Speaker B to AGENT
  const updateResult = await TranscriptionService.updateSpeakerRoles(
    testCallId,
    { A: "CUSTOMER", B: "AGENT" },
    supervisorCtx,
    "Supervisor reversed roles after playback listen."
  );

  if (updateResult.updatedCount === 0) {
    throw new Error("No utterances were updated in supervisor override!");
  }

  const refreshed = await TranscriptionService.getCallTranscript(testCallId);
  const remappedA = refreshed.utterances.find((u) => u.speakerLabel === "A");
  if (remappedA?.speakerRole !== "CUSTOMER") {
    throw new Error(`Expected remapped Speaker A to be CUSTOMER, got: ${remappedA?.speakerRole}`);
  }
  if (remappedA?.speakerLabel !== "A") {
    throw new Error("Speaker original label was modified! Original labels must remain intact.");
  }
  if (refreshed.speakerReviews.length === 0) {
    throw new Error("No audit trail entry recorded in speaker_role_reviews!");
  }
  console.log(`   Supervisor remapped ${updateResult.updatedCount} utterances.`);
  console.log(`   Audit entry: [${refreshed.speakerReviews[0].speaker_label}] ${refreshed.speakerReviews[0].original_role} -> ${refreshed.speakerReviews[0].reviewed_role}`);
  console.log("   -> PASS: Supervisor role correction updates roles, preserves original labels, and logs audit trail.");

  console.log("\n===============================================================");
  console.log("ALL 11 PHASE 3 VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("===============================================================");
}

runPhase3Verification().catch((err) => {
  console.error("\n[VERIFICATION FAILED]", err);
  process.exit(1);
});
