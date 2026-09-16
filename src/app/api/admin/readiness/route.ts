import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { features } from "@/lib/config/features";

/**
 * Protected Admin Readiness Endpoint (Specification Section 53)
 * Provides high-level operational component status without exposing secrets or keys.
 */
export async function GET() {
  const hasAssemblyAiKey = Boolean(
    process.env.ASSEMBLYAI_API_KEY &&
    !process.env.ASSEMBLYAI_API_KEY.includes("your-") &&
    process.env.ASSEMBLYAI_API_KEY.length > 10
  );

  const hasWebhookSecret = Boolean(
    process.env.ASSEMBLYAI_WEBHOOK_SECRET &&
    !process.env.ASSEMBLYAI_WEBHOOK_SECRET.includes("your-")
  );

  const mockEnabled =
    process.env.ENABLE_MOCK_TRANSCRIPTION === "true" &&
    process.env.NODE_ENV !== "production";

  return NextResponse.json(
    {
      database: isSupabaseConfigured() ? "ready" : "local_fallback",
      storage: isSupabaseConfigured() ? "ready" : "local_fallback",
      transcriptionProvider: (process.env.TRANSCRIPTION_PROVIDER || "assemblyai").toLowerCase(),
      mockEnabled,
      assemblyAi: hasAssemblyAiKey ? "configured" : "unconfigured",
      webhook: hasWebhookSecret ? "configured" : "unconfigured",
      aiQa: features.aiQa ? "enabled" : "disabled",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
