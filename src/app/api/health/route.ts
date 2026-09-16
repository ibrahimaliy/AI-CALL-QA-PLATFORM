import { NextResponse } from "next/server";

/**
 * Public Health Endpoint (Specification Section 52)
 * Returns minimal operational health status.
 * Never exposes credentials, secret names, internal hostnames, or bucket configuration.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
