import { z } from "zod";
import { STORAGE_CONFIG } from "@/lib/storage/config";

const UUIDSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid UUID format");

export const CreateCallUploadIntentSchema = z.object({
  agentId: UUIDSchema,
  campaignId: UUIDSchema,
  scorecardId: UUIDSchema,
  interactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)"),
  interactionTime: z.string().min(4),
  issueType: z.string().min(2, "Issue type is required"),
  queryCount: z.number().int().min(1, "Query count must be at least 1").default(1),
  jiraTransactionNumber: z.string().optional().nullable(),
  customerPhoneMasked: z.string().optional().nullable(),
  externalCallId: z.string().optional().nullable(),
  clientRequestId: z.string().min(8, "clientRequestId / idempotency key is required"),
  fileName: z.string().min(3, "File name must not be empty"),
  fileSizeBytes: z
    .number()
    .positive("File size must be greater than 0 bytes")
    .max(STORAGE_CONFIG.MAX_CALL_UPLOAD_BYTES, `File size exceeds max ${STORAGE_CONFIG.MAX_CALL_UPLOAD_MB} MB limit`),
  mimeType: z.string().refine(
    (val) => STORAGE_CONFIG.ALLOWED_MIME_TYPES.some((m) => m === val.toLowerCase()),
    {
      message: `Invalid audio MIME type. Only MP3, WAV, and M4A audio files are allowed.`,
    }
  ),
});

export const ConfirmUploadInputSchema = z.object({
  callId: UUIDSchema,
  storagePath: z.string().min(5),
  fileSizeBytes: z.number().positive(),
  recordingChecksum: z.string().optional().nullable(),
  durationSeconds: z.number().nonnegative().optional().nullable(),
});

export type CreateCallUploadIntentInput = z.infer<typeof CreateCallUploadIntentSchema>;
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;
