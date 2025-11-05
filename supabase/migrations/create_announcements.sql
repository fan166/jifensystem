-- Create announcements table and RLS policies

-- Ensure uuid generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Table: announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for sorting
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements (created_at DESC);

-- 2. Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Allow all users (including unauthenticated) to read announcements to ensure system-wide visibility
CREATE POLICY announcements_select_all ON announcements
    FOR SELECT
    USING (true);

-- Only admins can insert/update/delete announcements
CREATE POLICY announcements_insert_admin ON announcements
    FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('system_admin','assessment_admin')
        )
    );

CREATE POLICY announcements_update_admin ON announcements
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('system_admin','assessment_admin')
        )
    );

CREATE POLICY announcements_delete_admin ON announcements
    FOR DELETE
    USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('system_admin','assessment_admin')
        )
    );