import { TranscriptionProvider } from "@/lib/providers/transcription/types";
import { AssemblyAITranscriptionProvider } from "@/lib/providers/transcription/assemblyai.provider";
import { MockTranscriptionProvider } from "@/lib/providers/transcription/mock.provider";

/**
 * Diagnostic functionality showing safe provider status.
 * Section 4.
 */
export function getTranscriptionDiagnostics() {
  const provider = (process.env.TRANSCRIPTION_PROVIDER || "UNCONFIGURED").trim().toUpperCase();
  const mockEnabled = process.env.ENABLE_MOCK_TRANSCRIPTION === "true";
  const apiKeyConfigured = Boolean(
    process.env.ASSEMBLYAI_API_KEY &&
      process.env.ASSEMBLYAI_API_KEY !== "your-assemblyai-api-key" &&
      process.env.ASSEMBLYAI_API_KEY.length > 10
  );
  const webhookUrl = process.env.ASSEMBLYAI_WEBHOOK_URL || "";
  const webhookConfigured = Boolean(webhookUrl && webhookUrl.length > 5);
  const webhookHttpsPublic = webhookConfigured && webhookUrl.startsWith("https://");

  return {
    configuredProvider: provider,
    mockEnabled,
    apiKeyConfigured,
    webhookConfigured,
    webhookHttpsPublic,
  };
}

/**
 * Strict fail-closed transcription provider factory.
 * Specification Section 1.
 * NEVER silently falls back to MockTranscriptionProvider.
 */
export function createTranscriptionProvider(): TranscriptionProvider {
  const providerName = (process.env.TRANSCRIPTION_PROVIDER || "").trim().toLowerCase();
  const mockEnabled = process.env.ENABLE_MOCK_TRANSCRIPTION === "true";

  // Safely log selected provider and whether mock is enabled without secrets
  console.info(
    `[TranscriptionProvider] Selected provider: ${providerName || "undefined"} | Mock Enabled: ${mockEnabled}`
  );

  if (providerName === "assemblyai") {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey || apiKey === "your-assemblyai-api-key" || apiKey.length < 10) {
      throw new Error(
        "ASSEMBLYAI_API_KEY is required when TRANSCRIPTION_PROVIDER=assemblyai"
      );
    }

    return new AssemblyAITranscriptionProvider({
      apiKey,
    });
  }

  if (providerName === "mock") {
    if (process.env.NODE_ENV === "production" || !mockEnabled) {
      throw new Error("Mock transcription is disabled in this environment.");
    }

    return new MockTranscriptionProvider();
  }

  throw new Error(
    `Unsupported or missing transcription provider: '${providerName || "undefined"}'. Set TRANSCRIPTION_PROVIDER=assemblyai or TRANSCRIPTION_PROVIDER=mock (with ENABLE_MOCK_TRANSCRIPTION=true in non-production).`
  );
}
