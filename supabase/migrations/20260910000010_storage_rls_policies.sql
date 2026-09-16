-- Migration 20260910000010: Ensure call-recordings bucket and RLS policies on storage.objects
-- Fixes: "403 new row violates row-level security policy" and "400 Unauthorized" on audio uploads

-- 1. Create call-recordings bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'call-recordings',
    'call-recordings',
    false,
    52428800, -- 50 MB
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 52428800;

-- 2. Permissive storage policies on call-recordings bucket
DO $$ BEGIN
    CREATE POLICY "Allow upload to call-recordings"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'call-recordings');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Allow select on call-recordings"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'call-recordings');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Allow update on call-recordings"
    ON storage.objects FOR UPDATE
    TO public
    USING (bucket_id = 'call-recordings');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
