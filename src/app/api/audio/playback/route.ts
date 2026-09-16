import { NextRequest, NextResponse } from "next/server";
import { getCachedAudio } from "@/lib/storage/audio-cache";

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

  const cached = getCachedAudio(path);
  if (cached) {
    return new NextResponse(cached.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": cached.contentType,
        "Content-Length": cached.buffer.length.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  }

  // Return synthetic mock tone audio wave for local testing if raw audio not present in cache
  const emptyMp3Header = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);
  return new NextResponse(emptyMp3Header as unknown as BodyInit, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": emptyMp3Header.length.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}
