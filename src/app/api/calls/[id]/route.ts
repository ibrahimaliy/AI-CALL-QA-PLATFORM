import { NextRequest, NextResponse } from "next/server";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

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

    const details = await CallService.getCallById(id, userContext);
    return NextResponse.json({ success: true, ...details });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch call details.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 404 });
  }
}
