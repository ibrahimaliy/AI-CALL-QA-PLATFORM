import {
  validateTranscriptResult,
  TranscriptValidationError,
} from "../src/services/transcription/transcript-validator";
import { NormalizedUtterance } from "../src/lib/providers/transcription/types";

async function runDurationRegressionTest() {
  console.log("====================================================");
  console.log("TRANSCRIPTION DURATION REGRESSION TEST");
  console.log("====================================================");

  const realRecordingDurationMs = 437080; // 7 minutes 17.08 seconds
  const mockTranscriptDurationMs = 27200; // ~27.2 seconds mock duration

  console.log(`Expected Audio Duration: ${realRecordingDurationMs} ms (~07:17)`);
  console.log(`Mock Transcript Duration: ${mockTranscriptDurationMs} ms (~00:27)`);

  const mockUtterances: NormalizedUtterance[] = [
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

  let rejected = false;
  let caughtCode = "";

  try {
    validateTranscriptResult({
      callId: "test-call-id",
      expectedAudioDurationMs: realRecordingDurationMs,
      providerAudioDurationMs: mockTranscriptDurationMs,
      utterances: mockUtterances,
      fullText: mockUtterances.map((u) => u.text).join(" "),
      provider: "ASSEMBLYAI",
      jobChecksum: "d688d7d8f752a7002fc4dfb400480a3d19db0a9bb7dfb8a0ab1dfefbdf310303",
      callChecksum: "d688d7d8f752a7002fc4dfb400480a3d19db0a9bb7dfb8a0ab1dfefbdf310303",
      allowMock: false,
    });
  } catch (err: unknown) {
    if (err instanceof TranscriptValidationError) {
      rejected = true;
      caughtCode = err.code;
      console.log(`\nValidation correctly rejected mock transcript with code: ${err.code}`);
      console.log(`Error message: ${err.message}`);
    } else {
      throw err;
    }
  }

  if (!rejected) {
    console.error("FAIL: Mock transcript was NOT rejected!");
    process.exit(1);
  }

  if (caughtCode !== "TRANSCRIPT_DURATION_MISMATCH" && caughtCode !== "KNOWN_MOCK_FIXTURE_DETECTED") {
    console.error(`FAIL: Unexpected rejection code: ${caughtCode}`);
    process.exit(1);
  }

  console.log("\nREGRESSION TEST PASSED: Mock fixture can NEVER be accepted for a 7-minute call.");
  console.log("====================================================");
}

runDurationRegressionTest().catch((err) => {
  console.error("Regression test error:", err);
  process.exit(1);
});
