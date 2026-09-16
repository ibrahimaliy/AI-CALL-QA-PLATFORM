import { NextRequest, NextResponse } from "next/server";
import { ReviewService, ensureBenchmarkDatasetSeeded } from "@/services/reviews/review.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function GET(req: NextRequest) {
  try {
    ensureBenchmarkDatasetSeeded();

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const assignedToMe = searchParams.get("assignedToMe") === "true";

    const reviews = ReviewService.listReviews(
      { status, priority, assignedToMe, organizationId: userContext.organizationId },
      userContext
    );

    return NextResponse.json({
      success: true,
      reviews,
      total: reviews.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch reviews.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureBenchmarkDatasetSeeded();

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_MANAGER",
      fullName: "QA Manager",
    };

    const body = await req.json();
    const { auditId, reviewId, reviewerId, priority, dueAt } = body;

    if (auditId && !reviewId) {
      const review = await ReviewService.getOrCreateReview(auditId, userContext);
      return NextResponse.json({ success: true, review });
    }

    if (reviewId && reviewerId) {
      const review = await ReviewService.assignReview(
        reviewId,
        reviewerId,
        priority || "NORMAL",
        userContext,
        dueAt
      );
      return NextResponse.json({ success: true, review });
    }

    return NextResponse.json(
      { success: false, error: "Invalid request payload: provide auditId or (reviewId and reviewerId)." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process review request.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
