-- ====================================================================
-- PHASE 4 DATABASE MIGRATION: TRANSCRIPT-GROUNDED AI QA ENGINE
-- Specification: Sections 2.1, 13, 14, 29, 38
-- ====================================================================

-- 1. Extend transcripts table with versioning and active flag (Section 2.1)
ALTER TABLE transcripts 
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_transcripts_active ON transcripts(call_id, is_active);

-- 2. Audit Runs table (Section 13)
-- Pre-flight persistence for AI evaluation requests to guarantee auditability,
-- cost observability, idempotency, and version history.
CREATE TABLE IF NOT EXISTS audit_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    scorecard_id UUID NOT NULL REFERENCES scorecards(id),
    scorecard_version VARCHAR(50) NOT NULL,
    transcript_id UUID NOT NULL REFERENCES transcripts(id),
    provider VARCHAR(100) NOT NULL DEFAULT 'OPENAI',
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-5.6-terra',
    prompt_version VARCHAR(50) NOT NULL DEFAULT 'qa-audit-v1',
    input_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    request_token_count INT,
    response_token_count INT,
    response_id VARCHAR(255),
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_runs_call_id ON audit_runs(call_id);
CREATE INDEX IF NOT EXISTS idx_audit_runs_input_hash ON audit_runs(call_id, input_hash);

-- 3. Parameter Scoring Policies table (Section 29)
-- Explicit scoring policy configuration so AI interprets findings,
-- while the backend deterministic engine determines awarded points.
CREATE TABLE IF NOT EXISTS parameter_scoring_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_parameter_id UUID NOT NULL REFERENCES scorecard_parameters(id) ON DELETE CASCADE,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('BINARY', 'RULE_WEIGHTED', 'DEDUCTION', 'RUBRIC', 'MANUAL')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_param_active_policy UNIQUE (scorecard_parameter_id)
);

-- 4. Enable Row Level Security (RLS) on new Phase 4 tables
ALTER TABLE audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE parameter_scoring_policies ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Scoped to organization members
CREATE POLICY "Users can view audit runs within their organization"
    ON audit_runs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM calls c
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = audit_runs.call_id
              AND om.user_id = auth.uid()
              AND om.active = true
        )
    );

CREATE POLICY "Auditors can insert audit runs within their organization"
    ON audit_runs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM calls c
            JOIN organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = audit_runs.call_id
              AND om.user_id = auth.uid()
              AND om.active = true
              AND om.role IN ('ADMIN', 'QA_MANAGER', 'QA_AUDITOR')
        )
    );

CREATE POLICY "Users can view scoring policies within their organization"
    ON parameter_scoring_policies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM scorecard_parameters sp
            JOIN scorecards s ON s.id = sp.scorecard_id
            JOIN organization_members om ON om.organization_id = s.organization_id
            WHERE sp.id = parameter_scoring_policies.scorecard_parameter_id
              AND om.user_id = auth.uid()
              AND om.active = true
        )
    );
