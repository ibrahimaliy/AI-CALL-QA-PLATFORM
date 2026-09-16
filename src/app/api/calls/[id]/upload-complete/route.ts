import { NextRequest, NextResponse } from "next/server";
import { ConfirmUploadInputSchema } from "@/schemas/call.schema";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const validated = ConfirmUploadInputSchema.parse({
      ...body,
      callId: id,
    });

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    const call = await CallService.confirmCallUpload(validated, userContext);

    return NextResponse.json({ success: true, call });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to confirm upload.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }
}
