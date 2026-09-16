import { NextRequest, NextResponse } from "next/server";
import { CreateCallUploadIntentSchema } from "@/schemas/call.schema";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CreateCallUploadIntentSchema.parse(body);

    // Mock/resolved user context for active session (Ayinde Andrea - QA Auditor / Supervisor)
    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    const result = await CallService.createCallWithUploadIntent(validated, userContext);

    return NextResponse.json({
      success: true,
      call: result.call,
      uploadAuthorization: result.uploadAuthorization,
      isExisting: result.isExisting,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Invalid upload intent request.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
