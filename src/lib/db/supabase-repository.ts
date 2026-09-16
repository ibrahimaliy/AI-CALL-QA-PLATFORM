import { getSupabaseServerClient, isSupabaseConfigured, assertProductionStatelessness } from "../supabase/server";
import { CallRecord, ProcessingEventRecord } from "@/types/scorecard";
import {
  NormalizedUtterance,
  CallAudioMetrics,
  SpeakerRole,
  TranscriptionJobStatus,
} from "@/lib/providers/transcription/types";
import { StoredTranscript, StoredTranscriptionJob } from "@/services/transcription/transcription.service";
import { INITIAL_ORGANIZATION, INITIAL_AGENT, INITIAL_CAMPAIGN, INITIAL_SCORECARD } from "@/lib/seed-data";

export class SupabaseRepository {
  /**
   * Checks if Supabase repository is enabled and active.
   */
  static isEnabled(): boolean {
    return isSupabaseConfigured();
  }

  // ==========================================
  // CALLS
  // ==========================================

  static async ensureOrganization(orgId: string = INITIAL_ORGANIZATION.id): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    try {
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase.from("organizations").upsert(
          {
            id: orgId,
            name: INITIAL_ORGANIZATION.name,
            slug: INITIAL_ORGANIZATION.slug,
            active: true,
          },
          { onConflict: "id" }
        );
        if (error) {
          // If slug conflict, try with unique slug suffix
          await supabase.from("organizations").upsert(
            {
              id: orgId,
              name: INITIAL_ORGANIZATION.name,
              slug: `${INITIAL_ORGANIZATION.slug}-${orgId.slice(0, 8)}`,
              active: true,
            },
            { onConflict: "id" }
          );
        }
      }
    } catch (err) {
      console.warn("ensureOrganization non-fatal notice:", err);
    }
  }

  static async ensureScorecard(
    scorecardId?: string | null,
    orgId: string = INITIAL_ORGANIZATION.id,
    campaignId: string = INITIAL_CAMPAIGN.id
  ): Promise<void> {
    if (!scorecardId) return;
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    try {
      const { data: existing } = await supabase
        .from("scorecards")
        .select("id")
        .eq("id", scorecardId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("scorecards").upsert(
          {
            id: scorecardId,
            organization_id: orgId,
            campaign_id: campaignId,
            name: INITIAL_SCORECARD.name,
            version: INITIAL_SCORECARD.version,
            passing_score: INITIAL_SCORECARD.passing_score,
            status: "published",
          },
          { onConflict: "id" }
        );
      }
    } catch (err) {
      console.warn("ensureScorecard notice:", err);
    }
  }

  static async ensureAgentAndCampaign(
    agent?: {
      id: string;
      name: string;
      employee_code?: string | null;
      organization_id: string;
      campaign_id?: string | null;
    } | null,
    campaign?: {
      id: string;
      name: string;
      organization_id: string;
    } | null
  ): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    try {
      const orgId = agent?.organization_id || campaign?.organization_id || INITIAL_ORGANIZATION.id;
      await this.ensureOrganization(orgId);

      if (campaign?.id && campaign?.name) {
        await supabase.from("campaigns").upsert(
          {
            id: campaign.id,
            organization_id: campaign.organization_id || orgId,
            name: campaign.name,
            active: true,
          },
          { onConflict: "id" }
        );
      }

      if (agent?.id && agent?.name) {
        await supabase.from("agents").upsert(
          {
            id: agent.id,
            organization_id: agent.organization_id || orgId,
            campaign_id: agent.campaign_id || null,
            name: agent.name,
            employee_code: agent.employee_code || `AGT-${agent.id.slice(0, 4).toUpperCase()}`,
            active: true,
          },
          { onConflict: "id" }
        );
      }
    } catch (err) {
      console.warn("ensureAgentAndCampaign non-fatal notice:", err);
    }
  }

  static async getCall(id: string): Promise<CallRecord | null> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("calls")
      .select("*, agents(id, name, employee_code), campaigns(id, name), scorecards(id, name)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Supabase getCall error:", error);
      throw new Error(`Database error fetching call [${id}]: ${error.message}`);
    }
    if (!data) return null;

    const relAgent = data.agents as { name?: string } | null;
    const relCampaign = data.campaigns as { name?: string } | null;
    const relScorecard = data.scorecards as { name?: string } | null;

    return {
      id: data.id,
      organization_id: data.organization_id,
      campaign_id: data.campaign_id,
      agent_id: data.agent_id,
      scorecard_id: data.scorecard_id,
      external_call_id: data.external_call_id,
      client_request_id: data.client_request_id,
      jira_transaction_number: data.jira_transaction_number,
      customer_phone_masked: data.customer_phone_masked,
      interaction_date: data.interaction_date,
      interaction_time: data.interaction_time,
      issue_type: data.issue_type,
      query_count: data.query_count || 1,
      audio_storage_path: data.audio_storage_path,
      audio_size_bytes: data.audio_size_bytes,
      audio_content_type: data.audio_content_type || "audio/wav",
      recording_checksum: data.recording_checksum,
      duration_seconds: data.duration_seconds,
      audio_duration_ms: data.audio_duration_ms,
      language: data.language || "en",
      processing_status: data.processing_status,
      processing_error: data.processing_error,
      uploaded_at: data.uploaded_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      agent_name: relAgent?.name || data.agent_name || INITIAL_AGENT.name,
      campaign_name: relCampaign?.name || data.campaign_name || INITIAL_CAMPAIGN.name,
      scorecard_name: relScorecard?.name || data.scorecard_name || INITIAL_SCORECARD.name,
    };
  }

  static async saveCall(call: CallRecord): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    // Ensure organization and scorecard exist before inserting call record
    await this.ensureOrganization(call.organization_id);
    if (call.scorecard_id) {
      await this.ensureScorecard(call.scorecard_id, call.organization_id, call.campaign_id);
    }

    const row: Record<string, any> = {
      id: call.id,
      organization_id: call.organization_id,
      campaign_id: call.campaign_id,
      agent_id: call.agent_id,
      scorecard_id: call.scorecard_id,
      external_call_id: call.external_call_id,
      jira_transaction_number: call.jira_transaction_number,
      customer_phone_masked: call.customer_phone_masked,
      interaction_date: call.interaction_date,
      interaction_time: call.interaction_time,
      issue_type: call.issue_type,
      query_count: call.query_count,
      audio_storage_path: call.audio_storage_path,
      duration_seconds: call.duration_seconds,
      language: call.language,
      processing_status: call.processing_status,
      processing_error: call.processing_error,
      created_at: call.created_at,
      updated_at: call.updated_at || new Date().toISOString(),
    };

    let { error } = await supabase.from("calls").upsert(row);

    // Fallback 1: Un-migrated database enum
    if (
      error &&
      error.message?.includes("call_processing_status") &&
      (row.processing_status === "UPLOADING" || (row.processing_status as string) === "PENDING_UPLOAD")
    ) {
      row.processing_status = "UPLOADED";
      const retry = await supabase.from("calls").upsert(row);
      error = retry.error;
    }

    // Fallback 2: Foreign key violation on organization
    if (error && error.message?.includes("calls_organization_id_fkey")) {
      await this.ensureOrganization(call.organization_id);
      try {
        const { data: anyOrgs } = await supabase.from("organizations").select("id").limit(1);
        if (anyOrgs && anyOrgs.length > 0) {
          row.organization_id = anyOrgs[0].id;
        }
      } catch {
        // ignore lookup error
      }
      const retry = await supabase.from("calls").upsert(row);
      error = retry.error;
    }

    // Fallback 3: Foreign key violation on optional references (campaign, agent, scorecard)
    if (error && error.message?.includes("violates foreign key constraint")) {
      if (error.message.includes("campaign")) row.campaign_id = null;
      if (error.message.includes("agent")) row.agent_id = null;
      if (error.message.includes("scorecard")) row.scorecard_id = null;
      const retry = await supabase.from("calls").upsert(row);
      error = retry.error;
    }

    if (error) {
      console.error("Supabase saveCall error:", error);
      const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
      if (isVercel) {
        throw new Error(`Database error saving call [${call.id}]: ${error.message}`);
      } else {
        console.warn(`[Local Dev] Supabase sync deferred for call [${call.id}] due to constraint: ${error.message}`);
      }
    }
  }

  static async listCalls(organizationId?: string): Promise<CallRecord[]> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
      .from("calls")
      .select("*, agents(id, name, employee_code), campaigns(id, name), scorecards(id, name)")
      .order("created_at", { ascending: false });

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Supabase listCalls error:", error);
      throw new Error(`Database error listing calls: ${error.message}`);
    }

    return (data || []).map((row) => {
      const relAgent = row.agents as { name?: string } | null;
      const relCampaign = row.campaigns as { name?: string } | null;
      const relScorecard = row.scorecards as { name?: string } | null;
      return {
        id: row.id,
        organization_id: row.organization_id,
        campaign_id: row.campaign_id,
        agent_id: row.agent_id,
        scorecard_id: row.scorecard_id,
        external_call_id: row.external_call_id,
        jira_transaction_number: row.jira_transaction_number,
        customer_phone_masked: row.customer_phone_masked,
        interaction_date: row.interaction_date,
        interaction_time: row.interaction_time,
        issue_type: row.issue_type,
        query_count: row.query_count || 1,
        audio_storage_path: row.audio_storage_path,
        duration_seconds: row.duration_seconds,
        language: row.language || "en",
        processing_status: row.processing_status,
        processing_error: row.processing_error,
        created_at: row.created_at,
        updated_at: row.updated_at,
        agent_name: relAgent?.name || INITIAL_AGENT.name,
        campaign_name: relCampaign?.name || INITIAL_CAMPAIGN.name,
        scorecard_name: relScorecard?.name || INITIAL_SCORECARD.name,
      };
    });
  }

  // ==========================================
  // PROCESSING EVENTS
  // ==========================================

  static async addProcessingEvent(callId: string, event: ProcessingEventRecord): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const { error } = await supabase.from("processing_events").insert({
      id: event.id || crypto.randomUUID(),
      call_id: callId,
      stage: event.stage,
      status: event.status,
      message: event.message,
      metadata: event.metadata || {},
      created_at: event.created_at || new Date().toISOString(),
    });

    if (error) {
      console.error("Supabase addProcessingEvent error:", error);
    }
  }

  static async getProcessingEvents(callId: string): Promise<ProcessingEventRecord[]> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("processing_events")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase getProcessingEvents error:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      call_id: row.call_id,
      stage: row.stage,
      status: row.status,
      message: row.message,
      metadata: row.metadata,
      created_at: row.created_at,
    }));
  }

  // ==========================================
  // TRANSCRIPTION JOBS
  // ==========================================

  static async saveTranscriptionJob(job: StoredTranscriptionJob): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const row = {
      id: job.id,
      call_id: job.call_id,
      provider: job.provider,
      provider_transcript_id: job.provider_transcript_id,
      status: job.status,
      attempt_number: job.attempt_number,
      submitted_at: job.submitted_at,
      completed_at: job.completed_at,
      failed_at: job.failed_at,
      error_message: job.error_message,
      provider_metadata: job.provider_metadata || {},
      created_at: job.submitted_at,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("transcription_jobs")
      .upsert(row, { onConflict: "provider, provider_transcript_id" });

    if (error) {
      console.error("Supabase saveTranscriptionJob error:", error);
      throw new Error(`Database error saving transcription job: ${error.message}`);
    }
  }

  static async getTranscriptionJob(providerTranscriptId: string): Promise<StoredTranscriptionJob | null> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("transcription_jobs")
      .select("*")
      .eq("provider_transcript_id", providerTranscriptId)
      .maybeSingle();

    if (error) {
      console.error("Supabase getTranscriptionJob error:", error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      call_id: data.call_id,
      provider: data.provider,
      provider_transcript_id: data.provider_transcript_id,
      status: data.status as TranscriptionJobStatus,
      attempt_number: data.attempt_number,
      submitted_at: data.submitted_at,
      completed_at: data.completed_at,
      failed_at: data.failed_at,
      error_message: data.error_message,
      source_recording_checksum: data.source_recording_checksum,
      source_audio_size_bytes: data.source_audio_size_bytes,
      source_audio_duration_ms: data.source_audio_duration_ms,
      requested_speech_models: data.requested_speech_models,
      speech_model_used: data.speech_model_used,
      provider_metadata: data.provider_metadata,
    };
  }

  static async getTranscriptionJobsByCall(callId: string): Promise<StoredTranscriptionJob[]> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("transcription_jobs")
      .select("*")
      .eq("call_id", callId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Supabase getTranscriptionJobsByCall error:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      call_id: row.call_id,
      provider: row.provider,
      provider_transcript_id: row.provider_transcript_id,
      status: row.status as TranscriptionJobStatus,
      attempt_number: row.attempt_number,
      submitted_at: row.submitted_at,
      completed_at: row.completed_at,
      failed_at: row.failed_at,
      error_message: row.error_message,
      source_recording_checksum: row.source_recording_checksum,
      source_audio_size_bytes: row.source_audio_size_bytes,
      source_audio_duration_ms: row.source_audio_duration_ms,
      requested_speech_models: row.requested_speech_models,
      speech_model_used: row.speech_model_used,
      provider_metadata: row.provider_metadata,
    }));
  }

  // ==========================================
  // TRANSCRIPTS & UTTERANCES
  // ==========================================

  static async saveTranscript(
    transcript: StoredTranscript,
    utterances: NormalizedUtterance[],
    metrics?: CallAudioMetrics
  ): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    // 1. Insert/Update Transcript Record
    const transcriptRow = {
      id: transcript.id,
      call_id: transcript.call_id,
      provider: transcript.provider,
      provider_transcript_id: transcript.provider_transcript_id,
      full_text: transcript.full_text,
      language: transcript.language,
      confidence: transcript.confidence,
      audio_duration_ms: transcript.audio_duration_ms,
      requires_speaker_review: transcript.requires_speaker_review,
      requires_transcript_review: transcript.requires_transcript_review,
      transcript_review_reason: transcript.transcript_review_reason,
      created_at: transcript.created_at,
    };

    const { error: tErr } = await supabase.from("transcripts").upsert(transcriptRow, { onConflict: "call_id" });
    if (tErr) {
      console.error("Supabase saveTranscript error:", tErr);
      throw new Error(`Database error saving transcript: ${tErr.message}`);
    }

    // 2. Insert Utterances
    if (utterances.length > 0) {
      // Clear any previous utterances for this transcript
      await supabase.from("transcript_utterances").delete().eq("transcript_id", transcript.id);

      const utteranceRows = utterances.map((u, idx) => ({
        id: u.id || crypto.randomUUID(),
        transcript_id: transcript.id,
        utterance_index: u.utteranceIndex ?? idx,
        speaker_label: u.speakerLabel,
        speaker_role: u.speakerRole || "UNKNOWN",
        speaker_role_confidence: u.speakerRoleConfidence || 0.95,
        start_ms: u.startMs,
        end_ms: u.endMs,
        text: u.text,
        confidence: u.confidence,
        words: u.words || [],
        created_at: transcript.created_at,
      }));

      const { error: uErr } = await supabase.from("transcript_utterances").insert(utteranceRows);
      if (uErr) {
        console.error("Supabase saveTranscript utterances error:", uErr);
        throw new Error(`Database error saving transcript utterances: ${uErr.message}`);
      }
    }

    // 3. Save Call Audio Metrics if present
    if (metrics) {
      const metricRow = {
        call_id: transcript.call_id,
        speech_duration_ms: metrics.speechDurationMs,
        agent_utterance_count: metrics.agentUtteranceCount,
        customer_utterance_count: metrics.customerUtteranceCount,
        agent_word_count: metrics.agentWordCount,
        customer_word_count: metrics.customerWordCount,
        speaker_turn_count: metrics.speakerTurnCount,
        rough_talk_ratio: metrics.roughTalkRatio,
        rough_speech_rate_wpm: metrics.roughSpeechRateWpm,
        created_at: transcript.created_at,
      };
      await supabase.from("call_audio_metrics").upsert(metricRow);
    }
  }

  static async getActiveTranscript(callId: string): Promise<StoredTranscript | null> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("transcripts")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase getActiveTranscript error:", error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      call_id: data.call_id,
      version: 1,
      is_active: true,
      provider: data.provider,
      provider_transcript_id: data.provider_transcript_id,
      full_text: data.full_text,
      language: data.language,
      confidence: data.confidence,
      audio_duration_ms: data.audio_duration_ms || 0,
      requires_speaker_review: data.requires_speaker_review || false,
      requires_transcript_review: data.requires_transcript_review || false,
      transcript_review_reason: data.transcript_review_reason,
      created_at: data.created_at,
    };
  }

  static async getUtterances(transcriptId: string): Promise<NormalizedUtterance[]> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("transcript_utterances")
      .select("*")
      .eq("transcript_id", transcriptId)
      .order("utterance_index", { ascending: true });

    if (error) {
      console.error("Supabase getUtterances error:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      utteranceIndex: row.utterance_index,
      speakerLabel: row.speaker_label,
      speakerRole: row.speaker_role as SpeakerRole,
      speakerRoleConfidence: row.speaker_role_confidence,
      startMs: row.start_ms,
      endMs: row.end_ms,
      text: row.text,
      confidence: row.confidence,
      words: row.words || [],
    }));
  }

  static async updateSpeakerRoles(
    transcriptId: string,
    roleOverrides: Record<string, SpeakerRole>,
    reviewerId?: string,
    reason?: string
  ): Promise<void> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    for (const [speakerLabel, newRole] of Object.entries(roleOverrides)) {
      // 1. Update utterances with this speaker label
      const { error: updateErr } = await supabase
        .from("transcript_utterances")
        .update({ speaker_role: newRole })
        .eq("transcript_id", transcriptId)
        .eq("speaker_label", speakerLabel);

      if (updateErr) {
        console.error(`Error updating speaker role for ${speakerLabel}:`, updateErr);
      }

      // 2. Audit record in speaker_role_reviews
      await supabase.from("speaker_role_reviews").insert({
        id: crypto.randomUUID(),
        transcript_id: transcriptId,
        speaker_label: speakerLabel,
        original_role: "UNKNOWN",
        reviewed_role: newRole,
        reviewer_id: reviewerId || null,
        reason: reason || "Manual supervisor role attribution update",
        created_at: new Date().toISOString(),
      });
    }

    // 3. Mark requires_speaker_review = false on transcript
    await supabase
      .from("transcripts")
      .update({ requires_speaker_review: false })
      .eq("id", transcriptId);
  }

  static async getCallAudioMetrics(callId: string): Promise<CallAudioMetrics | null> {
    assertProductionStatelessness();
    const supabase = getSupabaseServerClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("call_audio_metrics")
      .select("*")
      .eq("call_id", callId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      callId: data.call_id,
      speechDurationMs: data.speech_duration_ms,
      agentUtteranceCount: data.agent_utterance_count,
      customerUtteranceCount: data.customer_utterance_count,
      agentWordCount: data.agent_word_count,
      customerWordCount: data.customer_word_count,
      speakerTurnCount: data.speaker_turn_count,
      roughTalkRatio: Number(data.rough_talk_ratio),
      roughSpeechRateWpm: data.rough_speech_rate_wpm,
    };
  }
}
