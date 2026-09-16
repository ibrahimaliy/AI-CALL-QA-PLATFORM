// Centralized Audio Upload & Storage Configuration
// Specification Sections 7, 10, 11

export const STORAGE_CONFIG = {
  BUCKET_NAME: "call-recordings",
  MAX_CALL_UPLOAD_MB: 50,
  MAX_CALL_UPLOAD_BYTES: 50 * 1024 * 1024,
  SIGNED_PLAYBACK_EXPIRES_IN_SECONDS: 15 * 60, // 15 minutes TTL
  SIGNED_UPLOAD_EXPIRES_IN_SECONDS: 30 * 60, // 30 minutes TTL
  ALLOWED_MIME_TYPES: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/aac",
  ] as const,
  ALLOWED_EXTENSIONS: [".mp3", ".wav", ".m4a", ".aac"] as const,
};

export type AllowedMimeType = (typeof STORAGE_CONFIG.ALLOWED_MIME_TYPES)[number];

/**
 * Validates audio file MIME type and extension server-side.
 */
export function validateAudioFile(
  fileName: string,
  mimeType: string,
  fileSizeBytes: number
): { valid: boolean; error?: string } {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: "File name must not be empty." };
  }

  if (fileSizeBytes <= 0) {
    return { valid: false, error: "File cannot be empty (0 bytes)." };
  }

  if (fileSizeBytes > STORAGE_CONFIG.MAX_CALL_UPLOAD_BYTES) {
    return {
      valid: false,
      error: `File size (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum limit of ${STORAGE_CONFIG.MAX_CALL_UPLOAD_MB} MB.`,
    };
  }

  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  const hasValidExt = STORAGE_CONFIG.ALLOWED_EXTENSIONS.some((e) => e === ext);
  const hasValidMime = STORAGE_CONFIG.ALLOWED_MIME_TYPES.some((m) => m === mimeType.toLowerCase());

  if (!hasValidExt || !hasValidMime) {
    return {
      valid: false,
      error: `Unsupported audio format (${ext}, ${mimeType}). Only MP3, WAV, and M4A audio files are permitted.`,
    };
  }

  return { valid: true };
}

/**
 * Generates structured private storage object path:
 * organizationId/campaignId/callId/clean-filename.ext
 */
export function generateCallStoragePath(
  organizationId: string,
  campaignId: string,
  callId: string,
  fileName: string
): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${organizationId}/${campaignId}/${callId}/${sanitizedName}`;
}
