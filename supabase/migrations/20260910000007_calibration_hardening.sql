-- Phase 5A.1: Calibration Hardening & Dataset Versioning
-- Specification Sections 4, 5, 6, 7, 8, 13, 18, 19, 20

-- 1. Create calibration_datasets table
CREATE TABLE IF NOT EXISTS calibration_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  dataset_source_type VARCHAR(50) NOT NULL CHECK (dataset_source_type IN ('SYNTHETIC', 'REAL_VALIDATED', 'PRODUCTION_REVIEWED')),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FROZEN', 'ARCHIVED')),
  min_sample_size INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  frozen_at TIMESTAMPTZ,
  UNIQUE(organization_id, name, version)
);

-- 2. Create calibration_dataset_items table
CREATE TABLE IF NOT EXISTS calibration_dataset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES calibration_datasets(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES audit_reviews(id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dataset_id, call_id)
);

-- 3. Extend qa_gold_labels table with dataset scoping & evidence granularity
ALTER TABLE qa_gold_labels
  ADD COLUMN IF NOT EXISTS dataset_id UUID REFERENCES calibration_datasets(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS transcript_id UUID REFERENCES transcripts(id),
  ADD COLUMN IF NOT EXISTS evidence_relevance VARCHAR(50) CHECK (evidence_relevance IN ('RELEVANT', 'PARTIALLY_RELEVANT', 'IRRELEVANT')),
  ADD COLUMN IF NOT EXISTS evidence_sufficiency VARCHAR(50) CHECK (evidence_sufficiency IN ('SUFFICIENT', 'PARTIALLY_SUFFICIENT', 'INSUFFICIENT')),
  ADD COLUMN IF NOT EXISTS secondary_reviewer_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS secondary_human_result VARCHAR(50),
  ADD COLUMN IF NOT EXISTS secondary_failure_reason VARCHAR(100);

-- Unique logical key constraint for gold decisions (Section 5)
-- Prevents unintentional double-counting across transcript or scorecard revisions
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_gold_labels_logical_key
  ON qa_gold_labels (dataset_id, call_id, transcript_id, scorecard_version, parameter_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_cal_datasets_org ON calibration_datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_cal_datasets_status ON calibration_datasets(status);
CREATE INDEX IF NOT EXISTS idx_cal_dataset_items_ds ON calibration_dataset_items(dataset_id);
CREATE INDEX IF NOT EXISTS idx_qa_gold_labels_dataset ON qa_gold_labels(dataset_id);

-- RLS Policies
ALTER TABLE calibration_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_dataset_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read/write calibration_datasets" ON calibration_datasets
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

CREATE POLICY "Allow authenticated read/write calibration_dataset_items" ON calibration_dataset_items
  FOR ALL
  TO authenticated
  USING (
    dataset_id IN (
      SELECT id FROM calibration_datasets
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  )
  WITH CHECK (
    dataset_id IN (
      SELECT id FROM calibration_datasets
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );
