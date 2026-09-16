import { NextRequest, NextResponse } from "next/server";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Resolve Auth Context
    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    const call = await CallService.getCallRecord(id);
    if (!call) {
      return NextResponse.json({ success: false, error: `Call [${id}] not found.` }, { status: 404 });
    }

    let body: { speakerMode?: "AUTO" | "EXACT_TWO"; forceMock?: boolean; simulateWebhook?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const result = await TranscriptionService.submitCallForTranscription(call, userContext, {
      speakerMode: body.speakerMode,
      forceMock: body.forceMock,
    });

    // If simulating instant completion (e.g. for mock or testing without an external tunnel)
    if (body.simulateWebhook || body.forceMock || result.job.provider === "MockTranscriptionProvider") {
      await TranscriptionService.handleProviderCompletion(
        result.job.provider_transcript_id,
        "completed",
        call
      );
    }

    return NextResponse.json({
      success: true,
      job: result.job,
      isNew: result.isNew,
      processingStatus: call.processing_status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to initiate transcription.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await TranscriptionService.syncJobStatus(id);
    const call = await CallService.getCallRecord(id);
    return NextResponse.json({
      success: true,
      status: call?.processing_status,
      completed: result.completed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sync transcription status.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
