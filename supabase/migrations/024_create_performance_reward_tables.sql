-- 绩效奖励积分模块表结构
-- 包含奖励申请、审批流程、奖励记录等功能

-- 1. 奖励类型配置表
CREATE TABLE IF NOT EXISTS reward_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE, -- 奖励类型名称
    category VARCHAR(50) NOT NULL CHECK (category IN ('commendation', 'advanced', 'innovation', 'special')), -- 奖励类别
    base_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 基础分值
    max_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 最高分值
    description TEXT, -- 奖励描述
    is_active BOOLEAN NOT NULL DEFAULT true, -- 是否启用
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 奖励申请表
CREATE TABLE IF NOT EXISTS reward_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type_id UUID NOT NULL REFERENCES reward_types(id) ON DELETE RESTRICT,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 申请人
    title VARCHAR(200) NOT NULL, -- 申请标题
    description TEXT NOT NULL, -- 申请说明
    evidence_files JSONB DEFAULT '[]'::jsonb, -- 证明材料文件
    applied_score DECIMAL(5,2) NOT NULL, -- 申请分值
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'cancelled')),
    reviewer_id UUID REFERENCES users(id), -- 审核人
    review_comment TEXT, -- 审核意见
    reviewed_at TIMESTAMPTZ, -- 审核时间
    final_score DECIMAL(5,2), -- 最终得分
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 奖励审批流程表
CREATE TABLE IF NOT EXISTS reward_approval_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES reward_applications(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL, -- 审批步骤顺序
    approver_id UUID NOT NULL REFERENCES users(id), -- 审批人
    approver_role VARCHAR(50) NOT NULL, -- 审批人角色
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
    comment TEXT, -- 审批意见
    approved_at TIMESTAMPTZ, -- 审批时间
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id, step_order)
);

-- 4. 奖励积分记录表（扩展现有rewards表功能）
CREATE TABLE IF NOT EXISTS reward_score_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES reward_applications(id) ON DELETE SET NULL,
    reward_type_id UUID NOT NULL REFERENCES reward_types(id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL, -- 奖励标题
    description TEXT, -- 奖励描述
    score DECIMAL(5,2) NOT NULL, -- 奖励分值
    award_date DATE NOT NULL DEFAULT CURRENT_DATE, -- 奖励日期
    award_period VARCHAR(20) NOT NULL, -- 奖励周期（月度/季度/年度）
    issuer_id UUID NOT NULL REFERENCES users(id), -- 颁发人
    certificate_number VARCHAR(100), -- 证书编号
    is_public BOOLEAN NOT NULL DEFAULT true, -- 是否公开
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 月度奖励汇总表
CREATE TABLE IF NOT EXISTS monthly_reward_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    total_rewards INTEGER NOT NULL DEFAULT 0, -- 奖励次数
    total_score DECIMAL(8,2) NOT NULL DEFAULT 0, -- 总分值
    commendation_score DECIMAL(8,2) NOT NULL DEFAULT 0, -- 表彰加分
    advanced_score DECIMAL(8,2) NOT NULL DEFAULT 0, -- 先进加分
    innovation_score DECIMAL(8,2) NOT NULL DEFAULT 0, -- 创新加分
    special_score DECIMAL(8,2) NOT NULL DEFAULT 0, -- 专项加分
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- 创建索引
CREATE INDEX idx_reward_types_category ON reward_types(category);
CREATE INDEX idx_reward_types_active ON reward_types(is_active);

CREATE INDEX idx_reward_applications_user ON reward_applications(user_id);
CREATE INDEX idx_reward_applications_status ON reward_applications(status);
CREATE INDEX idx_reward_applications_date ON reward_applications(application_date);
CREATE INDEX idx_reward_applications_type ON reward_applications(reward_type_id);

CREATE INDEX idx_reward_approval_flows_application ON reward_approval_flows(application_id);
CREATE INDEX idx_reward_approval_flows_approver ON reward_approval_flows(approver_id);
CREATE INDEX idx_reward_approval_flows_status ON reward_approval_flows(status);

CREATE INDEX idx_reward_score_records_user ON reward_score_records(user_id);
CREATE INDEX idx_reward_score_records_date ON reward_score_records(award_date);
CREATE INDEX idx_reward_score_records_type ON reward_score_records(reward_type_id);
CREATE INDEX idx_reward_score_records_period ON reward_score_records(award_period);

CREATE INDEX idx_monthly_reward_summary_user ON monthly_reward_summary(user_id);
CREATE INDEX idx_monthly_reward_summary_period ON monthly_reward_summary(year, month);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reward_types_updated_at BEFORE UPDATE ON reward_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reward_applications_updated_at BEFORE UPDATE ON reward_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reward_approval_flows_updated_at BEFORE UPDATE ON reward_approval_flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reward_score_records_updated_at BEFORE UPDATE ON reward_score_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_monthly_reward_summary_updated_at BEFORE UPDATE ON monthly_reward_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE reward_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_approval_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_score_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reward_summary ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略

-- 奖励类型表：管理员可管理，其他用户只读
CREATE POLICY "reward_types_admin_all" ON reward_types
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin')
    ));

CREATE POLICY "reward_types_read_all" ON reward_types
    FOR SELECT USING (is_active = true);

-- 奖励申请表：用户可管理自己的申请，管理员和审核人可查看相关申请
CREATE POLICY "reward_applications_own" ON reward_applications
    FOR ALL USING (applicant_id = auth.uid());

CREATE POLICY "reward_applications_admin" ON reward_applications
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin', 'leader')
    ));

CREATE POLICY "reward_applications_reviewer" ON reward_applications
    FOR SELECT USING (reviewer_id = auth.uid());

-- 审批流程表：审批人可管理自己的审批记录
CREATE POLICY "reward_approval_flows_approver" ON reward_approval_flows
    FOR ALL USING (approver_id = auth.uid());

CREATE POLICY "reward_approval_flows_admin" ON reward_approval_flows
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin')
    ));

-- 奖励积分记录表：用户可查看自己的记录，管理员可管理所有记录
CREATE POLICY "reward_score_records_own" ON reward_score_records
    FOR SELECT USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "reward_score_records_admin" ON reward_score_records
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin', 'leader')
    ));

-- 月度汇总表：用户可查看自己的汇总，管理员可查看所有汇总
CREATE POLICY "monthly_reward_summary_own" ON monthly_reward_summary
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "monthly_reward_summary_admin" ON monthly_reward_summary
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin', 'leader')
    ));

-- 插入初始奖励类型数据
INSERT INTO reward_types (name, category, base_score, max_score, description) VALUES
('优秀员工', 'commendation', 10.0, 20.0, '月度/季度优秀员工表彰'),
('先进个人', 'advanced', 15.0, 30.0, '年度先进个人表彰'),
('创新奖励', 'innovation', 20.0, 50.0, '工作创新和改进奖励'),
('专项贡献', 'special', 10.0, 40.0, '专项工作突出贡献'),
('团队协作', 'commendation', 8.0, 15.0, '团队协作表现优秀'),
('服务标兵', 'advanced', 12.0, 25.0, '服务质量突出表彰');

-- 授权给anon和authenticated角色
GRANT SELECT ON reward_types TO anon, authenticated;
GRANT ALL PRIVILEGES ON reward_applications TO authenticated;
GRANT ALL PRIVILEGES ON reward_approval_flows TO authenticated;
GRANT ALL PRIVILEGES ON reward_score_records TO authenticated;
GRANT ALL PRIVILEGES ON monthly_reward_summary TO authenticated;