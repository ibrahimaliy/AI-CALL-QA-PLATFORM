-- Phase 5A: Human QA Review & Calibration Workflow
-- Specification Sections 8, 9, 10, 11, 15, 16, 17, 18, 20, 21, 22, 28, 38

-- 1. Extend audit_reviews table
ALTER TABLE audit_reviews 
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
  ADD COLUMN IF NOT EXISTS final_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS is_passed BOOLEAN,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Update status constraint on audit_reviews to support full lifecycle
ALTER TABLE audit_reviews DROP CONSTRAINT IF EXISTS audit_reviews_status_check;
ALTER TABLE audit_reviews ADD CONSTRAINT audit_reviews_status_check 
  CHECK (status IN ('UNASSIGNED', 'ASSIGNED', 'IN_REVIEW', 'SUBMITTED', 'APPROVED', 'REOPENED', 'FINALIZED'));

-- 2. Extend audit_result_overrides table
ALTER TABLE audit_result_overrides
  ADD COLUMN IF NOT EXISTS review_action VARCHAR(50) NOT NULL DEFAULT 'AGREED' CHECK (review_action IN ('AGREED', 'OVERRIDDEN')),
  ADD COLUMN IF NOT EXISTS ai_result VARCHAR(50),
  ADD COLUMN IF NOT EXISTS human_result VARCHAR(50) NOT NULL DEFAULT 'PASS' CHECK (human_result IN ('PASS', 'FAIL', 'PARTIAL', 'REVIEW_REQUIRED', 'NOT_APPLICABLE')),
  ADD COLUMN IF NOT EXISTS ai_failure_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS human_failure_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS override_reason_category VARCHAR(100) CHECK (override_reason_category IN (
    'AI_MISSED_EVIDENCE',
    'AI_MISINTERPRETED_EVIDENCE',
    'TRANSCRIPT_ERROR',
    'SPEAKER_MAPPING_ERROR',
    'QA_RULE_INTERPRETATION',
    'INCORRECT_FAILURE_REASON',
    'INSUFFICIENT_CONTEXT',
    'OTHER'
  )),
  ADD COLUMN IF NOT EXISTS override_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_evidence_accuracy VARCHAR(50) CHECK (ai_evidence_accuracy IN ('CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT')),
  ADD COLUMN IF NOT EXISTS human_evidence_utterance_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_source VARCHAR(50) NOT NULL DEFAULT 'AI_TRANSCRIPT' CHECK (evaluation_source IN (
    'AI_TRANSCRIPT',
    'HUMAN_AUDIO',
    'HUMAN_HYBRID',
    'HUMAN_CRM'
  )),
  ADD COLUMN IF NOT EXISTS crm_checked BOOLEAN,
  ADD COLUMN IF NOT EXISTS jira_checked BOOLEAN;

-- 3. Create qa_gold_labels table for calibration benchmark data
CREATE TABLE IF NOT EXISTS qa_gold_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES audit_reviews(id) ON DELETE CASCADE,
  scorecard_id UUID NOT NULL REFERENCES scorecards(id),
  scorecard_version VARCHAR(50) NOT NULL,
  parameter_id UUID NOT NULL REFERENCES scorecard_parameters(id),
  parameter_name VARCHAR(255) NOT NULL,
  ai_result VARCHAR(50),
  human_result VARCHAR(50) NOT NULL,
  is_agreement BOOLEAN NOT NULL,
  ai_failure_reason VARCHAR(100),
  human_failure_reason VARCHAR(100),
  failure_reason_agreement BOOLEAN,
  ai_confidence NUMERIC(4,3),
  ai_evidence_accuracy VARCHAR(50),
  ai_evidence JSONB DEFAULT '[]'::jsonb,
  human_evidence JSONB DEFAULT '[]'::jsonb,
  reviewer_id UUID REFERENCES profiles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & reporting
CREATE INDEX IF NOT EXISTS idx_audit_reviews_status ON audit_reviews(status);
CREATE INDEX IF NOT EXISTS idx_audit_reviews_reviewer ON audit_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_audit_reviews_org ON audit_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_qa_gold_labels_call ON qa_gold_labels(call_id);
CREATE INDEX IF NOT EXISTS idx_qa_gold_labels_param ON qa_gold_labels(parameter_id);
CREATE INDEX IF NOT EXISTS idx_qa_gold_labels_org ON qa_gold_labels(organization_id);

-- RLS policies
ALTER TABLE qa_gold_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write qa_gold_labels" ON qa_gold_labels
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND active = true
    )
  );
