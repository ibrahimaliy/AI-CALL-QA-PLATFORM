import { CallProcessingStatus } from "@/types/scorecard";

/**
 * Centralized Call State Machine Transition Matrix
 * Specification Sections 12, 13, 28
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<CallProcessingStatus, CallProcessingStatus[]> = {
  PENDING_UPLOAD: ["UPLOADING", "FAILED", "CANCELLED"],
  UPLOADING: ["UPLOADED", "FAILED", "CANCELLED"],
  UPLOADED: ["TRANSCRIBING", "FAILED", "CANCELLED"],
  TRANSCRIBING: ["TRANSCRIBED", "FAILED", "CANCELLED"],
  TRANSCRIBED: ["AUDITING", "FAILED", "CANCELLED"],
  AUDITING: ["REVIEW_REQUIRED", "COMPLETED", "FAILED", "CANCELLED"],
  REVIEW_REQUIRED: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: ["CANCELLED"],
  FAILED: ["UPLOADING", "PENDING_UPLOAD", "CANCELLED"], // Allows upload retry without creating duplicate call
  CANCELLED: [],
};

/**
 * Validates whether transitioning from currentStatus to nextStatus is allowed.
 */
export function isValidStatusTransition(
  currentStatus: CallProcessingStatus,
  nextStatus: CallProcessingStatus
): boolean {
  if (currentStatus === nextStatus) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

/**
 * Asserts transition validity, throwing a descriptive error if forbidden.
 */
export function assertValidStatusTransition(
  currentStatus: CallProcessingStatus,
  nextStatus: CallProcessingStatus,
  callId?: string
): void {
  if (!isValidStatusTransition(currentStatus, nextStatus)) {
    throw new Error(
      `Forbidden call status transition from '${currentStatus}' to '${nextStatus}'${
        callId ? ` for call [${callId}]` : ""
      }.`
    );
  }
}
