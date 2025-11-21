-- Basic permission_settings table without FK to users and simplified RLS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS permission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_settings_key ON permission_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_permission_settings_enabled ON permission_settings(is_enabled);

ALTER TABLE permission_settings ENABLE ROW LEVEL SECURITY;

-- Allow read to everyone
CREATE POLICY permission_settings_select_all ON permission_settings
    FOR SELECT
    USING (true);

-- Allow writes to authenticated users (temporary until admin roles are defined)
CREATE POLICY permission_settings_insert_authenticated ON permission_settings
    FOR INSERT
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

CREATE POLICY permission_settings_update_authenticated ON permission_settings
    FOR UPDATE
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

CREATE POLICY permission_settings_delete_authenticated ON permission_settings
    FOR DELETE
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'authenticated');

GRANT SELECT ON permission_settings TO anon;
GRANT ALL PRIVILEGES ON permission_settings TO authenticated;

-- Seed defaults (id auto-generated). If already present, ignore
INSERT INTO permission_settings (setting_key, is_enabled, description)
    VALUES
    ('daily_evaluation_visible', false, '普通用户日常实绩评价界面可见性'),
    ('annual_evaluation_visible', false, '普通用户年终集体测评界面可见性'),
    ('evaluation_result_visible', true, '普通用户评价结果查看权限'),
    ('personal_score_visible', true, '普通用户个人积分查看权限'),
    ('statistics_visible', false, '普通用户积分统计分析界面