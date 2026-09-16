import { NextRequest, NextResponse } from "next/server";
import { ReviewService, ensureBenchmarkDatasetSeeded } from "@/services/reviews/review.service";
import { AuditService } from "@/services/auditing/audit.service";
import { CallService } from "@/services/calls/call.service";
import { TranscriptionService } from "@/services/transcription/transcription.service";
import { StorageService } from "@/lib/storage/storage.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { UserAuthContext } from "@/services/auth/authorization";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    ensureBenchmarkDatasetSeeded();
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    let review = ReviewService.getReviewById(id);
    if (!review) {
      // Check if `id` is an auditId rather than reviewId
      try {
        review = await ReviewService.getOrCreateReview(id, userContext);
      } catch {
        // Not an auditId
      }
    }

    if (!review) {
      return NextResponse.json({ success: false, error: `Review [${id}] not found.` }, { status: 404 });
    }

    const audit = await AuditService.getStoredAuditById(review.audit_id);
    const call = CallService.getRawCall(review.call_id);
    const transcriptData = await TranscriptionService.getCallTranscript(review.call_id);

    let signedAudioUrl: string | null = null;
    if (call?.audio_storage_path) {
      try {
        const signed = await StorageService.generateSignedPlaybackUrl(call.audio_storage_path, 3600);
        signedAudioUrl = signed.signedUrl;
      } catch {
        signedAudioUrl = null;
      }
    }

    return NextResponse.json({
      success: true,
      review,
      audit: audit || null,
      call: call || null,
      transcript: transcriptData.transcript,
      utterances: transcriptData.utterances,
      signedAudioUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load review workspace.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    ensureBenchmarkDatasetSeeded();
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_AUDITOR",
      fullName: "Ayinde Andrea",
    };

    const body = await req.json();
    const { expectedVersion, decisions, comment } = body;

    if (expectedVersion === undefined || !Array.isArray(decisions)) {
      return NextResponse.json(
        { success: false, error: "Missing required expectedVersion or decisions array." },
        { status: 400 }
      );
    }

    const updated = await ReviewService.saveDraftReview(
      id,
      expectedVersion,
      decisions,
      comment,
      userContext
    );

    return NextResponse.json({
      success: true,
      review: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save draft review.";
    const status = msg.includes("409 CONFLICT") ? 409 : 400;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    ensureBenchmarkDatasetSeeded();
    const { id } = await params;

    const userContext: UserAuthContext = {
      userId: "u0000000-0000-0000-0000-000000000001",
      organizationId: INITIAL_ORGANIZATION.id,
      role: "QA_MANAGER",
      fullName: "QA Manager",
    };

    const body = await req.json();
    const { action, expectedVersion, reopenReason } = body;

    let updatedReview;
    if (action === "submit") {
      updatedReview = await ReviewService.submitReview(id, expectedVersion ?? 1, userContext);
    } else if (action === "approve") {
      updatedReview = await ReviewService.approveReview(id, userContext);
    } else if (action === "finalize") {
      updatedReview = await ReviewService.finalizeReview(id, userContext);
    } else if (action === "reopen") {
      updatedReview = await ReviewService.reopenReview(id, reopenReason || "", userContext);
    } else {
      return NextResponse.json(
        { success: false, error: `Invalid action '${action}'. Expected 'submit', 'approve', 'finalize', or 'reopen'.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      review: updatedReview,
      status: updatedReview.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update review status.";
    const status = msg.includes("409 CONFLICT") ? 409 : 400;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
