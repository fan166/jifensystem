-- Minimal permission_settings table without RLS/grants
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

INSERT INTO permission_settings (setting_key, is_enabled, description)
    VALUES
    ('daily_evaluation_visible', false, '普通用户日常实绩评价界面可见性'),
    ('annual_evaluation_visible', false, '普通用户年终集体测评界面可见性'),
    ('evaluation_result_visible', true, '普通用户评价结果查看权限'),
    ('personal_score_visible', true, '普通用户个人积分查看权限'),
    ('statistics_visible', false, '普通用户积分统计分析界面可见性')
ON CONFLICT (setting_key) DO NOTHING;