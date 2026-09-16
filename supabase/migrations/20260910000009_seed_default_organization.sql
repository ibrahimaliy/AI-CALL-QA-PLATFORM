-- Migration 20260910000009: Seed default organization and baseline campaign/scorecard
-- Prevents calls_organization_id_fkey foreign key constraint violations

INSERT INTO organizations (id, name, slug, active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Smile Telecom International',
    'smile-telecom',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO campaigns (id, organization_id, name, description, active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Inbound Customer Support',
    'English voice customer service and technical query support',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO agents (id, organization_id, campaign_id, employee_code, name, email, active)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'AGT-1049',
    'Olabiyi Boluwatife Precious',
    'b.olabiyi@smiletelecom.com',
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO scorecards (id, organization_id, campaign_id, name, description, version, passing_score, status, effective_from)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'Inbound Customer Support QA Scorecard',
    'Official Quality Assurance Evaluation Framework for Inbound Calls',
    '1.0',
    71.0,
    'published',
    '2026-09-01T00:00:00.000Z'
) ON CONFLICT (id) DO NOTHING;
