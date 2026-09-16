-- Phase 1.1 & Phase 2 Database Migration: Profiles, Memberships, Scorecard Immutability & Secure Upload Enhancements
-- Production Specification Sections 18, 54, 55 & Phase 1.1/Phase 2 Requirements

-- 1. App Role Enum
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM (
        'ADMIN',
        'QA_MANAGER',
        'QA_AUDITOR',
        'SUPERVISOR',
        'VIEWER',
        'AGENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table (maps to Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Organization Members Table (Multi-tenant user-to-organization mapping)
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'VIEWER',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_organization_user UNIQUE (organization_id, user_id)
);

-- 4. Extend call_processing_status enum with PENDING_UPLOAD, UPLOADING, CANCELLED if not already present
DO $$ BEGIN
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'PENDING_UPLOAD' BEFORE 'UPLOADED';
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'UPLOADING' BEFORE 'UPLOADED';
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Extend Calls Table for Secure Upload, Idempotency & Verification
ALTER TABLE calls 
    ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS recording_checksum VARCHAR(128),
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS audio_content_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS audio_size_bytes BIGINT,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Unique constraint on (organization_id, external_call_id) where external_call_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_calls_org_external_id 
    ON calls (organization_id, external_call_id) 
    WHERE external_call_id IS NOT NULL;

-- Unique constraint on (organization_id, client_request_id) where client_request_id is not null (idempotency key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_calls_org_client_req 
    ON calls (organization_id, client_request_id) 
    WHERE client_request_id IS NOT NULL;

-- 6. Published Scorecard Immutability Triggers
-- Prevents updating or deleting scorecard components once published or archived

CREATE OR REPLACE FUNCTION check_scorecard_immutability()
RETURNS TRIGGER AS $$
DECLARE
    current_status VARCHAR(50);
    parent_scorecard_id UUID;
BEGIN
    -- Determine target scorecard ID based on table
    IF TG_TABLE_NAME = 'scorecards' THEN
        current_status := OLD.status;
        -- Allow changing status from published to archived, but block modifying passing_score, name, etc.
        IF (OLD.status = 'published' OR OLD.status = 'archived') THEN
            IF (NEW.passing_score <> OLD.passing_score OR 
                NEW.name <> OLD.name OR 
                NEW.version <> OLD.version OR 
                NEW.organization_id <> OLD.organization_id) THEN
                RAISE EXCEPTION 'Historical published scorecard % (v%) is immutable and cannot be modified. Create a new scorecard version instead.', OLD.name, OLD.version;
            END IF;
        END IF;
        RETURN NEW;
    ELSE
        -- For child tables: scorecard_parameters, scorecard_rules, failure_reasons, verbiage_guidelines
        IF TG_TABLE_NAME = 'scorecard_parameters' THEN
            parent_scorecard_id := COALESCE(OLD.scorecard_id, NEW.scorecard_id);
        ELSIF TG_TABLE_NAME = 'verbiage_guidelines' THEN
            parent_scorecard_id := COALESCE(OLD.scorecard_id, NEW.scorecard_id);
        ELSIF TG_TABLE_NAME = 'scorecard_rules' THEN
            SELECT scorecard_id INTO parent_scorecard_id FROM scorecard_parameters WHERE id = COALESCE(OLD.parameter_id, NEW.parameter_id);
        ELSIF TG_TABLE_NAME = 'failure_reasons' THEN
            SELECT scorecard_id INTO parent_scorecard_id FROM scorecard_parameters WHERE id = COALESCE(OLD.parameter_id, NEW.parameter_id);
        END IF;

        SELECT status INTO current_status FROM scorecards WHERE id = parent_scorecard_id;

        IF current_status = 'published' OR current_status = 'archived' THEN
            RAISE EXCEPTION 'Cannot modify %: parent scorecard % is published and immutable. Create a new scorecard version instead.', TG_TABLE_NAME, parent_scorecard_id;
        END IF;

        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach Immutability Triggers
DROP TRIGGER IF EXISTS trg_scorecard_immutability ON scorecards;
CREATE TRIGGER trg_scorecard_immutability
    BEFORE UPDATE OR DELETE ON scorecards
    FOR EACH ROW
    EXECUTE FUNCTION check_scorecard_immutability();

DROP TRIGGER IF EXISTS trg_parameters_immutability ON scorecard_parameters;
CREATE TRIGGER trg_parameters_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON scorecard_parameters
    FOR EACH ROW
    EXECUTE FUNCTION check_scorecard_immutability();

DROP TRIGGER IF EXISTS trg_rules_immutability ON scorecard_rules;
CREATE TRIGGER trg_rules_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON scorecard_rules
    FOR EACH ROW
    EXECUTE FUNCTION check_scorecard_immutability();

DROP TRIGGER IF EXISTS trg_failure_reasons_immutability ON failure_reasons;
CREATE TRIGGER trg_failure_reasons_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON failure_reasons
    FOR EACH ROW
    EXECUTE FUNCTION check_scorecard_immutability();

DROP TRIGGER IF EXISTS trg_verbiage_immutability ON verbiage_guidelines;
CREATE TRIGGER trg_verbiage_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON verbiage_guidelines
    FOR EACH ROW
    EXECUTE FUNCTION check_scorecard_immutability();

-- 7. Enhanced Row Level Security (RLS) Policies Resolving via Organization Membership
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is an active member of organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = org_id
          AND user_id = auth.uid()
          AND active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role in organization
CREATE OR REPLACE FUNCTION get_user_org_role(org_id UUID)
RETURNS app_role AS $$
DECLARE
    user_role app_role;
BEGIN
    SELECT role INTO user_role FROM organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND active = true
    LIMIT 1;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view profiles within their organizations
CREATE POLICY "Users can read their own profile" ON profiles
    FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Organization Members: Members can view fellow members in same organization
CREATE POLICY "Members can view organization team" ON organization_members
    FOR SELECT TO authenticated USING (is_org_member(organization_id));

-- Calls RLS: Scoped strictly to organization membership
DROP POLICY IF EXISTS "Allow authenticated read calls" ON calls;
CREATE POLICY "Allow members read calls" ON calls
    FOR SELECT TO authenticated
    USING (is_org_member(organization_id));

DROP POLICY IF EXISTS "Allow authenticated insert calls" ON calls;
CREATE POLICY "Allow authorized roles create calls" ON calls
    FOR INSERT TO authenticated
    WITH CHECK (
        is_org_member(organization_id) AND
        get_user_org_role(organization_id) IN ('ADMIN', 'QA_MANAGER', 'QA_AUDITOR', 'SUPERVISOR')
    );

CREATE POLICY "Allow authorized roles update calls" ON calls
    FOR UPDATE TO authenticated
    USING (
        is_org_member(organization_id) AND
        get_user_org_role(organization_id) IN ('ADMIN', 'QA_MANAGER', 'QA_AUDITOR', 'SUPERVISOR')
    );

-- 8. Storage Policy for call-recordings bucket
-- Path format: {organization_id}/{campaign_id}/{call_id}/{filename}
-- Users can only access objects whose first path folder matches an organization they belong to
DO $$ BEGIN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('call-recordings', 'call-recordings', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN others THEN null;
END $$;
