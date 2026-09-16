import { NextRequest, NextResponse } from "next/server";
import { CallService } from "@/services/calls/call.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { CallProcessingStatus } from "@/types/scorecard";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const agentId = searchParams.get("agentId") || undefined;
    const status = (searchParams.get("status") as CallProcessingStatus) || undefined;
    const searchQuery = searchParams.get("q") || undefined;

    const calls = await CallService.listCalls(INITIAL_ORGANIZATION.id, {
      agentId,
      status,
      searchQuery,
    });

    return NextResponse.json({ success: true, calls });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to list calls.";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
