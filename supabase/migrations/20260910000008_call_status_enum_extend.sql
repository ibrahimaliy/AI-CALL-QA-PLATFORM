-- Migration 20260910000008: Extend call_processing_status enum to include upload & cancellation statuses
-- Prevents 22P02 invalid input value errors during call creation

DO $$ BEGIN
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'PENDING_UPLOAD' BEFORE 'UPLOADED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'UPLOADING' BEFORE 'UPLOADED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE call_processing_status ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
