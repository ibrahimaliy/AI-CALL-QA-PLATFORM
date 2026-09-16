import { AppRole } from "@/types/scorecard";

export interface UserAuthContext {
  userId: string;
  organizationId: string;
  role: AppRole;
  fullName: string;
}

export class AuthorizationService {
  /**
   * Checks if user has permission to upload recordings or create calls.
   * Allowed: ADMIN, QA_MANAGER, QA_AUDITOR, SUPERVISOR
   * Denied: VIEWER, AGENT
   */
  static canUploadCall(role: AppRole): boolean {
    return ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR"].includes(role);
  }

  /**
   * Checks if user can access private audio playback.
   * Allowed: ADMIN, QA_MANAGER, QA_AUDITOR, SUPERVISOR, VIEWER
   */
  static canListenToPlayback(role: AppRole): boolean {
    return ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR", "VIEWER"].includes(role);
  }

  /**
   * Checks if user can manage scorecards (create new versions).
   * Allowed: ADMIN, QA_MANAGER
   */
  static canManageScorecards(role: AppRole): boolean {
    return ["ADMIN", "QA_MANAGER"].includes(role);
  }

  /**
   * Checks if user can override AI audit scores.
   * Allowed: ADMIN, QA_MANAGER, QA_AUDITOR, SUPERVISOR
   */
  static canReviewAudit(role: AppRole): boolean {
    return ["ADMIN", "QA_MANAGER", "QA_AUDITOR", "SUPERVISOR"].includes(role);
  }

  /**
   * Asserts user belongs to target organization.
   */
  static assertOrgAccess(userContext: UserAuthContext, targetOrgId: string): void {
    if (userContext.organizationId !== targetOrgId) {
      throw new Error(
        `Cross-organization access denied: user belongs to org [${userContext.organizationId}], not [${targetOrgId}].`
      );
    }
  }

  /**
   * Asserts user has permission to create call.
   */
  static assertCanCreateCall(userContext: UserAuthContext): void {
    if (!this.canUploadCall(userContext.role)) {
      throw new Error(
        `Permission denied: role '${userContext.role}' is not authorized to create or upload calls.`
      );
    }
  }
}
