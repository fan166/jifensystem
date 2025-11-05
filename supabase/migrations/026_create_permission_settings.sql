-- 文件名: 026_create_permission_settings.sql
-- 创建权限设置表，用于控制普通用户界面可见性

CREATE TABLE permission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    is_enabled BOOLEAN DEFAULT false,
    target_roles JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_permission_settings_key ON permission_settings(setting_key);
CREATE INDEX idx_permission_settings_enabled ON permission_settings(is_enabled);
CREATE INDEX idx_permission_settings_created_by ON permission_settings(created_by);

-- 创建更新时间触发器
CREATE TRIGGER update_permission_settings_updated_at 
    BEFORE UPDATE ON permission_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE permission_settings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "管理员可管理权限设置" ON permission_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );

CREATE POLICY "所有用户可查看权限设置" ON permission_settings
    FOR SELECT USING (true);

-- 授予权限
GRANT ALL PRIVILEGES ON permission_settings TO authenticated;
GRANT SELECT ON permission_settings TO anon;

-- 插入初始权限设置数据
INSERT INTO permission_settings (setting_key, is_enabled, description) VALUES
('daily_evaluation_visible', false, '普通用户日常实绩评价界面可见性'),
('annual_evaluation_visible', false, '普通用户年终集体测评界面可见性'),
('evaluation_result_visible', true, '普通用户评价结果查看权限'),
('personal_score_visible', true, '普通用户个人积分查看权限'),
('statistics_visible', false, '普通用户积分统计分析界面可见性');