import { NextRequest, NextResponse } from "next/server";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    let body: { speakerMode?: "AUTO" | "EXACT_TWO"; forceMock?: boolean; simulateWebhook?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const result = await TranscriptionService.retryTranscription(id, userContext, {
      speakerMode: body.speakerMode,
      forceMock: body.forceMock,
    });

    if (body.simulateWebhook || body.forceMock || result.job.provider === "MockTranscriptionProvider") {
      await TranscriptionService.handleProviderCompletion(
        result.job.provider_transcript_id,
        "completed"
      );
    }

    return NextResponse.json({
      success: true,
      job: result.job,
      isNew: result.isNew,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retry transcription.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
