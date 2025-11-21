-- Basic announcements table without FK to users and simplified RLS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements (created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow read to everyone
CREATE POLICY announcements_select_all ON announcements
    FOR SELECT
    USING (true);

-- Allow writes to authenticated users (temporary until admin roles are defined)
CREATE POLICY announcements_insert_authenticated ON announcements
    FOR INSERT
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

CREATE POLICY announcements_update_authenticated ON announcements
    FOR UPDATE
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

CREATE POLICY announcements_delete_authenticated ON announcements
    FOR DELETE
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

GRANT SELECT ON