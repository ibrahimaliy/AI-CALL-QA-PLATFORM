-- Supabase Row Level Security (RLS) Policies
-- Designed per Production Specification Sections 54 & 55

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorecard_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE verbiage_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_utterances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_parameter_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_result_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_events ENABLE ROW LEVEL SECURITY;

-- Helper policies for authenticated users
-- In production, policies enforce organization membership via JWT claim or auth.uid() lookup
CREATE POLICY "Allow authenticated read scorecards" ON scorecards
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read scorecard_parameters" ON scorecard_parameters
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read scorecard_rules" ON scorecard_rules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read failure_reasons" ON failure_reasons
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read verbiage_guidelines" ON verbiage_guidelines
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read calls" ON calls
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert calls" ON calls
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read transcripts" ON transcripts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read utterances" ON transcript_utterances
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read audits" ON audits
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read audit_results" ON audit_parameter_results
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read audit_evidence" ON audit_evidence
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read/write audit_reviews" ON audit_reviews
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write audit_overrides" ON audit_result_overrides
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role bypasses RLS automatically in Supabase
