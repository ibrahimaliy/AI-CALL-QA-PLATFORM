import { NextRequest, NextResponse } from "next/server";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext, AuthorizationService } from "@/services/auth/authorization";

export async function GET(
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

    const call = await CallService.getCallRecord(id);
    if (!call) {
      return NextResponse.json({ success: false, error: `Call [${id}] not found.` }, { status: 404 });
    }

    // Assert organization isolation (Section 61)
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    const data = await TranscriptionService.getCallTranscript(id);

    return NextResponse.json({
      success: true,
      callId: id,
      transcript: data.transcript,
      utterances: data.utterances,
      metrics: data.metrics,
      speakerReviews: data.speakerReviews,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve transcript.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
