-- Phase 3 Database Migration: Transcription, Diarization & Transcript Engine
-- Production Specification Sections 18, 19, 21, 22, 29, 51

-- 1. Transcription Job Status Enum
DO $$ BEGIN
    CREATE TYPE transcription_job_status AS ENUM (
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Transcription Jobs Table (Specification Section 18)
CREATE TABLE IF NOT EXISTS transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL DEFAULT 'ASSEMBLYAI',
    provider_transcript_id VARCHAR(255) NOT NULL,
    status transcription_job_status NOT NULL DEFAULT 'QUEUED',
    attempt_number INT NOT NULL DEFAULT 1,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_code VARCHAR(100),
    error_message TEXT,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_transcription_provider_job UNIQUE(provider, provider_transcript_id)
);

-- 3. Extend Transcripts Table with Review Flags & Duration (Sections 20, 31, 32, 33)
ALTER TABLE transcripts
    ADD COLUMN IF NOT EXISTS audio_duration_ms INT,
    ADD COLUMN IF NOT EXISTS requires_speaker_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS requires_transcript_review BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS transcript_review_reason VARCHAR(100);

-- 4. Extend Transcript Utterances with Word-level Timestamps (Section 22)
ALTER TABLE transcript_utterances
    ADD COLUMN IF NOT EXISTS words JSONB DEFAULT '[]'::jsonb;

-- 5. Speaker Role Reviews Table (Supervisor Audit Trail - Section 29)
CREATE TABLE IF NOT EXISTS speaker_role_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    speaker_label VARCHAR(50) NOT NULL,
    original_role VARCHAR(50) NOT NULL,
    reviewed_role VARCHAR(50) NOT NULL,
    reviewer_id UUID,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Call Audio Metrics Table (Derived Metrics Foundation - Sections 51, 52)
CREATE TABLE IF NOT EXISTS call_audio_metrics (
    call_id UUID PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
    speech_duration_ms INT NOT NULL DEFAULT 0,
    agent_utterance_count INT NOT NULL DEFAULT 0,
    customer_utterance_count INT NOT NULL DEFAULT 0,
    agent_word_count INT NOT NULL DEFAULT 0,
    customer_word_count INT NOT NULL DEFAULT 0,
    speaker_turn_count INT NOT NULL DEFAULT 0,
    rough_talk_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    rough_speech_rate_wpm INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Row Level Security Policies for New Tables
ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_role_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_audio_metrics ENABLE ROW LEVEL SECURITY;

-- Scoped to organization membership via parent call/transcript
CREATE POLICY "Members can read transcription_jobs" ON transcription_jobs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM calls c
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = transcription_jobs.call_id
              AND om.user_id = auth.uid()
              AND om.active = true
        )
    );

CREATE POLICY "Members can read speaker_role_reviews" ON speaker_role_reviews
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM transcripts t
            JOIN calls c ON c.id = t.call_id
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE t.id = speaker_role_reviews.transcript_id
              AND om.user_id = auth.uid()
              AND om.active = true
        )
    );

CREATE POLICY "Authorized roles can insert speaker_role_reviews" ON speaker_role_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM transcripts t
            JOIN calls c ON c.id = t.call_id
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE t.id = speaker_role_reviews.transcript_id
              AND om.user_id = auth.uid()
              AND om.active = true
              AND om.role IN ('ADMIN', 'QA_MANAGER', 'QA_AUDITOR', 'SUPERVISOR')
        )
    );

CREATE POLICY "Members can read call_audio_metrics" ON call_audio_metrics
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM calls c
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = call_audio_metrics.call_id
              AND om.user_id = auth.uid()
              AND om.active = true
        )
    );

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_call ON transcription_jobs(call_id, status);
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_provider_id ON transcription_jobs(provider, provider_transcript_id);
CREATE INDEX IF NOT EXISTS idx_speaker_reviews_transcript ON speaker_role_reviews(transcript_id);
