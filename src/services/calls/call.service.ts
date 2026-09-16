import { CallRecord, ProcessingEventRecord, CallProcessingStatus } from "@/types/scorecard";
import { CreateCallUploadIntentInput, ConfirmUploadInput } from "@/schemas/call.schema";
import { StorageService } from "@/lib/storage/storage.service";
import { assertValidStatusTransition } from "./state-machine";
import { AuthorizationService, UserAuthContext } from "../auth/authorization";
import { INITIAL_AGENT, INITIAL_CAMPAIGN, INITIAL_SCORECARD, INITIAL_ORGANIZATION } from "@/lib/seed-data";
import { getGlobalStores } from "@/lib/store/global-store";
import { SupabaseRepository } from "@/lib/db/supabase-repository";
import { assertProductionStatelessness } from "@/lib/supabase/server";

// Centralized global persistent data store accessor
function getStores() {
  return getGlobalStores();
}

export class CallService {
  /**
   * Retrieves CallRecord by ID checking memory first, then Supabase repository.
   */
  static async getCallRecord(callId: string): Promise<CallRecord | null> {
    const stores = getStores();
    const memoryCall = stores.calls.get(callId);
    if (memoryCall) return memoryCall;

    if (SupabaseRepository.isEnabled()) {
      const dbCall = await SupabaseRepository.getCall(callId);
      if (dbCall) {
        stores.calls.set(dbCall.id, dbCall);
        return dbCall;
      }
    }
    return null;
  }

  /**
   * Creates a new Call in PENDING_UPLOAD / UPLOADING and generates direct upload authorization.
   * Specification Sections 8, 9, 23, 24:
   * - Enforces Idempotency via clientRequestId.
   * - Validates organization, campaign, and agent bindings.
   * - Logs CALL_CREATED and UPLOAD_AUTHORIZED processing events.
   */
  static async createCallWithUploadIntent(
    input: CreateCallUploadIntentInput,
    userContext: UserAuthContext
  ): Promise<{
    call: CallRecord;
    uploadAuthorization: {
      storagePath: string;
      uploadUrl: string;
      uploadHeaders: Record<string, string>;
      expiresInSeconds: number;
    };
    isExisting: boolean;
  }> {
    // 1. Check Authorization & Production Deployment Preconditions
    AuthorizationService.assertCanCreateCall(userContext);
    assertProductionStatelessness();

    // 2. Idempotency check: Look for existing call with same clientRequestId in this organization
    const stores = getStores();
    for (const existing of stores.calls.values()) {
      if (
        existing.organization_id === userContext.organizationId &&
        existing.client_request_id === input.clientRequestId
      ) {
        // Return existing call idempotently
        const uploadAuth = await StorageService.createCallUploadAuthorization({
          organizationId: existing.organization_id,
          campaignId: existing.campaign_id,
          callId: existing.id,
          fileName: input.fileName,
          contentType: input.mimeType,
          fileSizeBytes: input.fileSizeBytes,
        });
        return { call: existing, uploadAuthorization: uploadAuth, isExisting: true };
      }
    }

    // 3. Create unique Call ID
    const callId = crypto.randomUUID();

    const agentId = input.agentId || INITIAL_AGENT.id;
    const campaignId = input.campaignId || INITIAL_CAMPAIGN.id;
    const scorecardId = input.scorecardId || INITIAL_SCORECARD.id;
    const agentName = input.agentName || INITIAL_AGENT.name;
    const campaignName = input.campaignName || INITIAL_CAMPAIGN.name;
    const scorecardName = input.scorecardName || INITIAL_SCORECARD.name;

    // 4. Generate Storage Upload Authorization
    const uploadAuth = await StorageService.createCallUploadAuthorization({
      organizationId: userContext.organizationId,
      campaignId,
      callId,
      fileName: input.fileName,
      contentType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
    });

    const now = new Date().toISOString();

    const newCall: CallRecord = {
      id: callId,
      organization_id: userContext.organizationId,
      campaign_id: campaignId,
      agent_id: agentId,
      scorecard_id: scorecardId,
      external_call_id: input.externalCallId || null,
      client_request_id: input.clientRequestId,
      jira_transaction_number: input.jiraTransactionNumber || null,
      customer_phone_masked: input.customerPhoneMasked || null,
      interaction_date: input.interactionDate,
      interaction_time: input.interactionTime,
      issue_type: input.issueType,
      query_count: input.queryCount,
      audio_storage_path: uploadAuth.storagePath,
      original_filename: input.fileName,
      audio_content_type: input.mimeType,
      audio_size_bytes: input.fileSizeBytes,
      processing_status: "UPLOADING", // ready for direct upload
      language: "en",
      created_at: now,
      updated_at: now,
      agent_name: agentName,
      campaign_name: campaignName,
      scorecard_name: scorecardName,
    };

    stores.calls.set(callId, newCall);

    // 5. Record initial processing events
    const events: ProcessingEventRecord[] = [
      {
        id: crypto.randomUUID(),
        call_id: callId,
        stage: "UPLOAD",
        status: "STARTED",
        message: "Call record created in PENDING_UPLOAD.",
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        call_id: callId,
        stage: "UPLOAD",
        status: "IN_PROGRESS",
        message: `Upload authorization granted for ${input.fileName} (${(input.fileSizeBytes / 1024).toFixed(0)} KB).`,
        created_at: now,
      },
    ];
    stores.events.set(callId, events);
    stores.saveState();

    if (SupabaseRepository.isEnabled()) {
      await SupabaseRepository.ensureAgentAndCampaign(
        {
          id: agentId,
          name: agentName,
          employee_code: input.agentEmployeeCode || null,
          organization_id: userContext.organizationId,
          campaign_id: campaignId,
        },
        {
          id: campaignId,
          name: campaignName,
          organization_id: userContext.organizationId,
        }
      );
      await SupabaseRepository.saveCall(newCall);
      for (const ev of events) {
        await SupabaseRepository.addProcessingEvent(callId, ev);
      }
    }

    return { call: newCall, uploadAuthorization: uploadAuth, isExisting: false };
  }

  /**
   * Confirms successful storage upload, transitions status to UPLOADED, and logs event.
   * Specification Sections 12, 16, 23
   */
  static async confirmCallUpload(
    input: ConfirmUploadInput,
    userContext: UserAuthContext
  ): Promise<CallRecord> {
    const stores = getStores();
    let call = stores.calls.get(input.callId);
    if (!call && SupabaseRepository.isEnabled()) {
      call = (await SupabaseRepository.getCall(input.callId)) || undefined;
      if (call) stores.calls.set(call.id, call);
    }
    if (!call) {
      throw new Error(`Call [${input.callId}] not found.`);
    }

    // Assert organization access
    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    // Validate storage object & server-side identity (Section 6)
    const verification = await StorageService.verifyStorageObject(
      input.storagePath,
      input.fileSizeBytes,
      input.recordingChecksum
    );
    if (!verification.verified) {
      throw new Error(verification.message || "Storage verification failed.");
    }

    // State machine check: UPLOADING -> UPLOADED
    assertValidStatusTransition(call.processing_status, "UPLOADED", call.id);

    const now = new Date().toISOString();
    call.processing_status = "UPLOADED";
    call.audio_storage_path = input.storagePath;
    call.audio_size_bytes = verification.serverSizeBytes || input.fileSizeBytes;
    call.recording_checksum = verification.serverChecksum || input.recordingChecksum || call.recording_checksum;
    
    if (verification.serverDurationMs) {
      call.audio_duration_ms = verification.serverDurationMs;
      call.duration_seconds = Math.round(verification.serverDurationMs / 1000);
    } else if (input.durationSeconds) {
      call.duration_seconds = input.durationSeconds;
      call.audio_duration_ms = input.durationSeconds * 1000;
    }
    call.uploaded_at = now;
    call.updated_at = now;

    // Log completion event
    const events = stores.events.get(call.id) || [];
    const completionEvent: ProcessingEventRecord = {
      id: crypto.randomUUID(),
      call_id: call.id,
      stage: "UPLOAD",
      status: "COMPLETED",
      message: "Call recording successfully confirmed in private storage bucket.",
      metadata: {
        storagePath: input.storagePath,
        sizeBytes: input.fileSizeBytes,
      },
      created_at: now,
    };
    events.push(completionEvent);
    stores.events.set(call.id, events);
    stores.saveState();

    if (SupabaseRepository.isEnabled()) {
      await SupabaseRepository.saveCall(call);
      await SupabaseRepository.addProcessingEvent(call.id, completionEvent);
    }

    return call;
  }

  /**
   * Retrieves Call details with processing timeline.
   */
  static async getCallById(
    callId: string,
    userContext: UserAuthContext
  ): Promise<{ call: CallRecord; events: ProcessingEventRecord[] }> {
    const stores = getStores();
    let call = stores.calls.get(callId);
    if (!call && SupabaseRepository.isEnabled()) {
      call = (await SupabaseRepository.getCall(callId)) || undefined;
      if (call) stores.calls.set(call.id, call);
    }
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }

    AuthorizationService.assertOrgAccess(userContext, call.organization_id);
    let events = stores.events.get(callId) || [];
    if (events.length === 0 && SupabaseRepository.isEnabled()) {
      events = await SupabaseRepository.getProcessingEvents(callId);
      stores.events.set(callId, events);
    }

    return { call, events };
  }

  /**
   * Generates signed playback URL for authorized user.
   */
  static async getCallPlaybackUrl(
    callId: string,
    userContext: UserAuthContext
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    const stores = getStores();
    let call = stores.calls.get(callId);
    if (!call && SupabaseRepository.isEnabled()) {
      call = (await SupabaseRepository.getCall(callId)) || undefined;
      if (call) stores.calls.set(call.id, call);
    }
    if (!call) {
      throw new Error(`Call [${callId}] not found.`);
    }

    AuthorizationService.assertOrgAccess(userContext, call.organization_id);

    if (!AuthorizationService.canListenToPlayback(userContext.role)) {
      throw new Error(`Role '${userContext.role}' is not authorized to play call recordings.`);
    }

    if (!call.audio_storage_path) {
      throw new Error("No audio recording is associated with this call.");
    }

    return StorageService.generateSignedPlaybackUrl(call.audio_storage_path);
  }

  /**
   * Lists calls for an organization with optional filtering.
   */
  static async listCalls(
    organizationId: string,
    filters?: {
      agentId?: string;
      status?: CallProcessingStatus;
      searchQuery?: string;
    }
  ): Promise<CallRecord[]> {
    const stores = getStores();
    if (SupabaseRepository.isEnabled()) {
      try {
        const dbCalls = await SupabaseRepository.listCalls(organizationId);
        for (const c of dbCalls) {
          stores.calls.set(c.id, c);
        }
      } catch (err) {
        console.error("Failed to list calls from Supabase, falling back to memory:", err);
      }
    }

    let calls = Array.from(stores.calls.values()).filter(
      (c) => c.organization_id === organizationId
    );

    if (filters?.agentId) {
      calls = calls.filter((c) => c.agent_id === filters.agentId);
    }
    if (filters?.status) {
      calls = calls.filter((c) => c.processing_status === filters.status);
    }
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      calls = calls.filter(
        (c) =>
          c.jira_transaction_number?.toLowerCase().includes(q) ||
          c.agent_name?.toLowerCase().includes(q) ||
          c.customer_phone_masked?.toLowerCase().includes(q) ||
          c.issue_type.toLowerCase().includes(q)
      );
    }

    return calls.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Internal direct lookup without auth checks (for backend orchestration)
   */
  static getRawCall(callId: string): CallRecord | undefined {
    return getStores().calls.get(callId);
  }

  /**
   * Updates a call in store and remote database
   */
  static updateCall(call: CallRecord): void {
    const stores = getStores();
    stores.calls.set(call.id, call);
    stores.saveState();
    if (SupabaseRepository.isEnabled()) {
      SupabaseRepository.saveCall(call).catch((err) => {
        console.error("Failed to update call in Supabase:", err);
      });
    }
  }

  /**
   * Records a processing event for a call
   */
  static addProcessingEvent(
    callId: string,
    event: Omit<ProcessingEventRecord, "id" | "call_id">
  ): void {
    const stores = getStores();
    const events = stores.events.get(callId) || [];
    const fullEvent: ProcessingEventRecord = {
      id: crypto.randomUUID(),
      call_id: callId,
      ...event,
    };
    events.push(fullEvent);
    stores.events.set(callId, events);
    stores.saveState();
    if (SupabaseRepository.isEnabled()) {
      SupabaseRepository.addProcessingEvent(callId, fullEvent).catch((err) => {
        console.error("Failed to save processing event to Supabase:", err);
      });
    }
  }
}
