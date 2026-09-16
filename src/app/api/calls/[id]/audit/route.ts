import { NextRequest, NextResponse } from "next/server";
import { AuditService } from "@/services/auditing/audit.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";
import { features } from "@/lib/config/features";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!features.aiQa) {
    return NextResponse.json(
      {
        success: false,
        code: "AI_QA_DISABLED",
        error: "AI QA auditing is currently disabled pending approved QA rules.",
      },
      { status: 403 }
    );
  }
  try {
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    let body: { forceMock?: boolean; forceNewRun?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const result = await AuditService.executeCallAudit(id, userContext, {
      forceMock: body.forceMock,
      forceNewRun: body.forceNewRun,
    });

    return NextResponse.json({
      success: true,
      audit: result.audit,
      run: result.run,
      isCached: result.isCached,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to execute AI QA audit.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

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

    const details = await AuditService.getCallAudit(id, userContext);

    return NextResponse.json({
      success: true,
      callId: id,
      audit: details.audit,
      runs: details.runs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve audit details.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
