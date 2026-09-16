import { NextRequest, NextResponse } from "next/server";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext, AuthorizationService } from "@/services/auth/authorization";
import { SpeakerRole } from "@/lib/providers/transcription/types";
import { z } from "zod";

const SpeakerOverrideSchema = z.object({
  roleOverrides: z.record(
    z.string(),
    z.enum(["AGENT", "CUSTOMER", "UNKNOWN"] as const)
  ),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "SUPERVISOR", // Supervisor context
      fullName: "Ayinde Andrea",
    };

    const call = await CallService.getCallRecord(id);
    if (!call) {
      return NextResponse.json({ success: false, error: `Call [${id}] not found.` }, { status: 404 });
    }

    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // Only authorized roles can review and correct speaker assignments (Sections 27-29)
    const allowedRoles = ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR"];
    if (!allowedRoles.includes(userContext.role)) {
      return NextResponse.json(
        { success: false, error: `Role '${userContext.role}' is not authorized to edit speaker roles.` },
        { status: 403 }
      );
    }

    const rawBody = await req.json();
    const parseResult = SpeakerOverrideSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid role overrides payload.", issues: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { roleOverrides, reason } = parseResult.data;

    const result = await TranscriptionService.updateSpeakerRoles(
      id,
      roleOverrides as Record<string, SpeakerRole>,
      userContext,
      reason
    );

    return NextResponse.json({
      success: true,
      callId: id,
      updatedCount: result.updatedCount,
      utterances: result.utterances,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update speaker roles.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
