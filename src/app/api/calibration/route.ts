import { NextRequest, NextResponse } from "next/server";
import { CalibrationService } from "@/services/calibration/calibration.service";
import { ensureBenchmarkDatasetSeeded, ReviewService } from "@/services/reviews/review.service";
import { INITIAL_ORGANIZATION } from "@/lib/seed-data";

export async function GET(req: NextRequest) {
  try {
    ensureBenchmarkDatasetSeeded();

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("organizationId") || INITIAL_ORGANIZATION.id;
    const datasetId = searchParams.get("datasetId") || undefined;

    const metrics = CalibrationService.computeCalibrationMetrics(datasetId, orgId);
    const datasets = ReviewService.listDatasets(orgId);

    return NextResponse.json({
      success: true,
      metrics,
      datasets,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to compute calibration metrics.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
