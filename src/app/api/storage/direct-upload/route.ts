import { NextRequest, NextResponse } from "next/server";
import { setCachedAudio } from "@/lib/storage/audio-cache";

export async function PUT(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const path = searchParams.get("path");

    if (!path) {
      return NextResponse.json({ error: "Missing storage path" }, { status: 400 });
    }

    const contentType = req.headers.get("content-type") || "audio/mpeg";
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    setCachedAudio(path, buffer, contentType);

    return NextResponse.json({
      success: true,
      path,
      sizeBytes: buffer.length,
    });
  } catch (err: unknown) {
    console.error("Direct upload error caught in handler:", err);
    const errorMessage = err instanceof Error ? err.stack || err.message : "Failed to store audio file";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
