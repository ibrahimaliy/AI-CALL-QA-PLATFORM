-- AI Call Quality Assurance Platform - Initial Schema Migration
-- Designed per Production Specification Sections 18-27, 41, 54, 57

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE audit_source_type AS ENUM (
        'TRANSCRIPT',
        'AUDIO',
        'KNOWLEDGE_BASE',
        'CRM',
        'HYBRID',
        'MANUAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_processing_status AS ENUM (
        'UPLOADED',
        'TRANSCRIBING',
        'TRANSCRIBED',
        'AUDITING',
        'REVIEW_REQUIRED',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE parameter_audit_result AS ENUM (
        'PASS',
        'PARTIAL',
        'FAIL',
        'REVIEW_REQUIRED',
        'NOT_APPLICABLE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE speaker_role_type AS ENUM (
        'AGENT',
        'CUSTOMER',
        'UNKNOWN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_stage_type AS ENUM (
        'UPLOAD',
        'TRANSCRIPTION',
        'DIARIZATION',
        'AUDIT',
        'SCORING',
        'REVIEW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    employee_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_agent_employee_code UNIQUE (organization_id, employee_code)
);

-- 4. Scorecards
CREATE TABLE IF NOT EXISTS scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    passing_score NUMERIC(5,2) NOT NULL DEFAULT 71.00,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Scorecard Parameters (10 parameters in baseline scorecard totaling 100 max weight)
CREATE TABLE IF NOT EXISTS scorecard_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id UUID NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
    section_name VARCHAR(150) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    description TEXT,
    max_weight NUMERIC(5,2) NOT NULL CHECK (max_weight >= 0),
    audit_source audit_source_type NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_critical BOOLEAN NOT NULL DEFAULT false,
    critical_failure_effect VARCHAR(100) DEFAULT 'ZERO_TOTAL_OR_REVIEW',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Scorecard Rules (Individual verifiable checks within a parameter)
CREATE TABLE IF NOT EXISTS scorecard_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id UUID NOT NULL REFERENCES scorecard_parameters(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(100) NOT NULL DEFAULT 'STANDARD',
    audit_source audit_source_type NOT NULL,
    knowledge_requirement TEXT,
    allocated_points NUMERIC(5,2) CHECK (allocated_points >= 0),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Failure Reasons (Direct mapping of workbook failure legend summary)
CREATE TABLE IF NOT EXISTS failure_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parameter_id UUID NOT NULL REFERENCES scorecard_parameters(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Verbiage Guidelines (Approved scripts and reference guidelines)
CREATE TABLE IF NOT EXISTS verbiage_guidelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_id UUID NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
    parameter VARCHAR(100) NOT NULL,
    language VARCHAR(50) NOT NULL DEFAULT 'English',
    suggested_verbiage TEXT NOT NULL,
    reference_guideline TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Calls
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    scorecard_id UUID REFERENCES scorecards(id) ON DELETE SET NULL,
    external_call_id VARCHAR(150),
    jira_transaction_number VARCHAR(150),
    customer_phone_masked VARCHAR(50),
    interaction_date DATE,
    interaction_time TIME,
    issue_type VARCHAR(150),
    query_count INT DEFAULT 1,
    audio_storage_path TEXT,
    duration_seconds INT,
    language VARCHAR(50) DEFAULT 'en',
    processing_status call_processing_status NOT NULL DEFAULT 'UPLOADED',
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL DEFAULT 'assemblyai',
    provider_transcript_id VARCHAR(255),
    full_text TEXT,
    language VARCHAR(50) DEFAULT 'en',
    speaker_count INT DEFAULT 2,
    confidence NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Transcript Utterances (Normalized segmented audio dialogue)
CREATE TABLE IF NOT EXISTS transcript_utterances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
    utterance_index INT NOT NULL,
    speaker_label VARCHAR(50) NOT NULL,
    speaker_role speaker_role_type NOT NULL DEFAULT 'UNKNOWN',
    speaker_role_confidence NUMERIC(5,4),
    start_ms INT NOT NULL,
    end_ms INT NOT NULL,
    text TEXT NOT NULL,
    confidence NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Audits (Immutable AI Evaluation Record)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    scorecard_id UUID NOT NULL REFERENCES scorecards(id),
    scorecard_version VARCHAR(50) NOT NULL,
    ai_provider VARCHAR(100),
    ai_model VARCHAR(100),
    auditable_weight NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ai_awarded_points NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    ai_normalized_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    final_score NUMERIC(5,2),
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    customer_sentiment VARCHAR(50),
    call_resolution VARCHAR(50),
    requires_human_review BOOLEAN NOT NULL DEFAULT false,
    critical_failure BOOLEAN NOT NULL DEFAULT false,
    summary TEXT,
    strengths JSONB DEFAULT '[]'::jsonb,
    improvement_areas JSONB DEFAULT '[]'::jsonb,
    raw_ai_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Audit Parameter Results (Individual parameter results)
CREATE TABLE IF NOT EXISTS audit_parameter_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    parameter_id UUID NOT NULL REFERENCES scorecard_parameters(id),
    max_weight NUMERIC(5,2) NOT NULL,
    awarded_points NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    result parameter_audit_result NOT NULL DEFAULT 'REVIEW_REQUIRED',
    confidence NUMERIC(5,4),
    reason TEXT,
    failure_reason_id UUID REFERENCES failure_reasons(id) ON DELETE SET NULL,
    requires_human_review BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Audit Evidence (Linking parameter decisions directly to transcript utterances)
CREATE TABLE IF NOT EXISTS audit_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_parameter_result_id UUID NOT NULL REFERENCES audit_parameter_results(id) ON DELETE CASCADE,
    utterance_id UUID REFERENCES transcript_utterances(id) ON DELETE SET NULL,
    evidence_type VARCHAR(50) NOT NULL DEFAULT 'TRANSCRIPT',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Audit Reviews (Supervisor human review layer)
CREATE TABLE IF NOT EXISTS audit_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    reviewer_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    original_ai_score NUMERIC(5,2) NOT NULL,
    reviewed_score NUMERIC(5,2),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Audit Result Overrides (Preserves AI findings while recording human judgment)
CREATE TABLE IF NOT EXISTS audit_result_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES audit_reviews(id) ON DELETE CASCADE,
    parameter_result_id UUID NOT NULL REFERENCES audit_parameter_results(id) ON DELETE CASCADE,
    ai_awarded_points NUMERIC(5,2) NOT NULL,
    human_awarded_points NUMERIC(5,2) NOT NULL,
    override_reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 17. Processing Events (Observability and tracking)
CREATE TABLE IF NOT EXISTS processing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    stage processing_stage_type NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls(organization_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_calls_interaction_date ON calls(interaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_utterances_transcript ON transcript_utterances(transcript_id, utterance_index);
CREATE INDEX IF NOT EXISTS idx_audit_results_audit ON audit_parameter_results(audit_id);
CREATE INDEX IF NOT EXISTS idx_processing_events_call ON processing_events(call_id, created_at ASC);
