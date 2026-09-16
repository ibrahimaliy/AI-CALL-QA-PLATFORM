import { NextRequest, NextResponse } from "next/server";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { z } from "zod";

const AssemblyAIWebhookSchema = z.object({
  transcript_id: z.string().min(1, "Missing transcript_id"),
  status: z.enum(["completed", "error"]),
  error: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate webhook secret if configured
    const expectedSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
    if (expectedSecret && expectedSecret !== "your-webhook-secret") {
      const headerSecret = req.headers.get("x-assemblyai-webhook-secret") || req.headers.get("authorization");
      const urlSecret = req.nextUrl.searchParams.get("secret");

      const providedSecret = headerSecret || urlSecret;
      if (!providedSecret || providedSecret !== expectedSecret) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: Invalid or missing webhook secret." },
          { status: 401 }
        );
      }
    }

    // 2. Parse and validate webhook payload
    const rawBody = await req.json();
    const parseResult = AssemblyAIWebhookSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook payload format.", issues: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { transcript_id, status, error } = parseResult.data;

    // 3. Process completion idempotently via TranscriptionService
    const outcome = await TranscriptionService.handleProviderCompletion(
      transcript_id,
      status,
      undefined,
      error
    );

    return NextResponse.json({
      success: outcome.success,
      alreadyProcessed: outcome.alreadyProcessed || false,
      message: outcome.alreadyProcessed
        ? "Webhook received: Transcript was already processed."
        : "Webhook received and processed successfully.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error processing webhook.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
