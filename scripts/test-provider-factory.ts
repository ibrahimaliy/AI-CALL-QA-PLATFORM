import { createTranscriptionProvider } from "../src/services/transcription/provider-factory";

async function runProviderFactoryTests() {
  console.log("====================================================");
  console.log("PROVIDER FACTORY FAIL-CLOSED SUITE (Section 24)");
  console.log("====================================================");

  const originalEnv = { ...process.env };

  function resetEnv() {
    process.env = { ...originalEnv };
  }

  let passed = 0;
  let total = 7;

  // 1. AssemblyAI selected, key exists -> AssemblyAI provider
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "assemblyai";
    process.env.ASSEMBLYAI_API_KEY = "test-real-assemblyai-key-123456";
    const provider = createTranscriptionProvider();
    if (provider.name === "ASSEMBLYAI") {
      console.log("Test 1: AssemblyAI selected + key exists -> PASS (Selected: ASSEMBLYAI)");
      passed++;
    } else {
      console.error("Test 1 FAIL: Expected ASSEMBLYAI, got", provider.name);
    }
  } catch (err: unknown) {
    console.error("Test 1 FAIL: Threw unexpectedly:", err);
  }

  // 2. AssemblyAI selected, key missing -> throws
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "assemblyai";
    delete process.env.ASSEMBLYAI_API_KEY;
    createTranscriptionProvider();
    console.error("Test 2 FAIL: Did not throw on missing AssemblyAI API key");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ASSEMBLYAI_API_KEY is required")) {
      console.log("Test 2: AssemblyAI selected + key missing -> PASS (Threw:", msg + ")");
      passed++;
    } else {
      console.error("Test 2 FAIL: Unexpected error message:", msg);
    }
  }

  // 3. Mock selected, mock enabled, non-production -> mock provider
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "mock";
    process.env.ENABLE_MOCK_TRANSCRIPTION = "true";
    (process.env as any).NODE_ENV = "development";
    const provider = createTranscriptionProvider();
    if (provider.name === "MOCK_PROVIDER") {
      console.log("Test 3: Mock selected + enabled + dev -> PASS (Selected: MOCK_PROVIDER)");
      passed++;
    } else {
      console.error("Test 3 FAIL: Expected MOCK_PROVIDER, got", provider.name);
    }
  } catch (err: unknown) {
    console.error("Test 3 FAIL: Threw unexpectedly:", err);
  }

  // 4. Mock selected, mock disabled -> throws
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "mock";
    process.env.ENABLE_MOCK_TRANSCRIPTION = "false";
    (process.env as any).NODE_ENV = "development";
    createTranscriptionProvider();
    console.error("Test 4 FAIL: Did not throw when mock disabled");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Mock transcription is disabled")) {
      console.log("Test 4: Mock selected + mock disabled -> PASS (Threw:", msg + ")");
      passed++;
    } else {
      console.error("Test 4 FAIL: Unexpected error message:", msg);
    }
  }

  // 5. Mock selected in production -> throws
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "mock";
    process.env.ENABLE_MOCK_TRANSCRIPTION = "true";
    (process.env as any).NODE_ENV = "production";
    createTranscriptionProvider();
    console.error("Test 5 FAIL: Did not throw for mock in production");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Mock transcription is disabled")) {
      console.log("Test 5: Mock selected in production -> PASS (Threw:", msg + ")");
      passed++;
    } else {
      console.error("Test 5 FAIL: Unexpected error message:", msg);
    }
  }

  // 6. Provider missing -> throws
  try {
    resetEnv();
    delete process.env.TRANSCRIPTION_PROVIDER;
    createTranscriptionProvider();
    console.error("Test 6 FAIL: Did not throw when provider missing");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unsupported or missing transcription provider")) {
      console.log("Test 6: Provider missing -> PASS (Threw:", msg + ")");
      passed++;
    } else {
      console.error("Test 6 FAIL: Unexpected error message:", msg);
    }
  }

  // 7. Unknown provider -> throws
  try {
    resetEnv();
    process.env.TRANSCRIPTION_PROVIDER = "unknown_provider_xyz";
    createTranscriptionProvider();
    console.error("Test 7 FAIL: Did not throw on unknown provider");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unsupported or missing transcription provider")) {
      console.log("Test 7: Unknown provider -> PASS (Threw:", msg + ")");
      passed++;
    } else {
      console.error("Test 7 FAIL: Unexpected error message:", msg);
    }
  }

  resetEnv();

  console.log("----------------------------------------------------");
  console.log(`Summary: ${passed}/${total} Provider Factory tests passed.`);
  if (passed === total) {
    console.log("ALL PROVIDER FACTORY FAIL-CLOSED TESTS PASSED");
    console.log("====================================================");
  } else {
    console.error("SOME TESTS FAILED!");
    process.exit(1);
  }
}

runProviderFactoryTests().catch((err) => {
  console.error("Error in provider factory test suite:", err);
  process.exit(1);
});
