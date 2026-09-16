import { NextRequest, NextResponse } from "next/server";
import { getCachedAudio } from "@/lib/storage/audio-cache";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { STORAGE_CONFIG } from "@/lib/storage/config";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const path = searchParams.get("path");
  const token = searchParams.get("token");
  const expires = searchParams.get("expires");

  if (!path || !token || !expires) {
    return new NextResponse("Unauthorized: Missing playback authorization token", { status: 401 });
  }

  const expiresTime = parseInt(expires, 10);
  if (Date.now() > expiresTime) {
    return new NextResponse("Forbidden: Playback URL has expired", { status: 403 });
  }

  // Token signature check
  const expectedToken = Buffer.from(`${path}:${expiresTime}`).toString("base64url");
  if (token !== expectedToken) {
    return new NextResponse("Forbidden: Invalid signature token", { status: 403 });
  }

  let audioBuffer: Buffer | null = null;
  let contentType = "audio/mpeg";

  // 1. Try in-memory / local disk cache
  const cached = getCachedAudio(path);
  if (cached) {
    audioBuffer = cached.buffer;
    contentType = cached.contentType;
  }

  // 2. If not in local cache, download directly from Supabase Storage if configured
  if (!audioBuffer && isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase.storage
          .from(STORAGE_CONFIG.BUCKET_NAME)
          .download(path);

        if (!error && data) {
          const arrayBuf = await data.arrayBuffer();
          audioBuffer = Buffer.from(arrayBuf);
          contentType =
            data.type ||
            (path.toLowerCase().endsWith(".wav")
              ? "audio/wav"
              : path.toLowerCase().endsWith(".m4a")
              ? "audio/mp4"
              : "audio/mpeg");
        } else if (error) {
          console.warn("Supabase playback storage download notice:", error.message);
        }
      }
    } catch (dbErr) {
      console.warn("Failed to fetch audio from Supabase Storage in playback route:", dbErr);
    }
  }

  if (!audioBuffer) {
    return new NextResponse("Audio recording not found or storage unavailable", { status: 404 });
  }

  const totalSize = audioBuffer.length;
  const rangeHeader = req.headers.get("range");

  // 3. Handle RFC-compliant HTTP 206 Partial Content (Range requests)
  // Required by Chrome, Safari, Edge, and mobile browsers for seeking, scrubbing, and buffering
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (isNaN(start) || start >= totalSize || end >= totalSize || start > end) {
      return new NextResponse("Requested Range Not Satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    const chunk = audioBuffer.subarray(start, end + 1);
    return new NextResponse(chunk as unknown as BodyInit, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunk.length.toString(),
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // 4. Standard full content response (HTTP 200)
  return new NextResponse(audioBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Length": totalSize.toString(),
      "Accept-Ranges": "bytes",
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
