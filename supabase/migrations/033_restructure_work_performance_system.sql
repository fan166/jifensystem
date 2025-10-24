-- 文件名: 033_restructure_work_performance_system.sql
-- 重构工作实绩积分系统，支持"多干多得"原则
-- 工作任务量(0-30分) + 工作完成质效(0-20分)
-- 日常实绩评价(80%) + 年终集体测评(20%)

-- 1. 创建工作任务详细评价表
CREATE TABLE IF NOT EXISTS work_task_detailed_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    -- 工作任务量评分 (0-30分)
    task_volume_score DECIMAL(4,2) DEFAULT 0 CHECK (task_volume_score >= 0 AND task_volume_score <= 30),
    task_volume_comments TEXT,
    -- 工作完成质效评分 (0-20分)
    task_quality_score DECIMAL(4,2) DEFAULT 0 CHECK (task_quality_score >= 0 AND task_quality_score <= 20),
    task_quality_comments TEXT,
    -- 总分 (0-50分)
    total_score DECIMAL(4,2) GENERATED ALWAYS AS (task_volume_score + task_quality_score) STORED,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, evaluator_id)
);

-- 2. 创建日常实绩评价汇总表
CREATE TABLE IF NOT EXISTS daily_performance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluation_period VARCHAR(20) NOT NULL, -- 格式: YYYY-MM
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_volume_score DECIMAL(6,2) DEFAULT 0,
    total_quality_score DECIMAL(6,2) DEFAULT 0,
    daily_total_score DECIMAL(6,2) DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, evaluation_period)
);

-- 3. 创建年终集体测评汇总表
CREATE TABLE IF NOT EXISTS annual_collective_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluation_year INTEGER NOT NULL,
    total_evaluations INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    weighted_score DECIMAL(5,2) DEFAULT 0,
    evaluation_rounds INTEGER DEFAULT 1,
    final_annual_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, evaluation_year)
);

-- 4. 创建最终工作实绩积分表
CREATE TABLE IF NOT EXISTS final_work_performance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluation_year INTEGER NOT NULL,
    -- 日常实绩评价积分 (80%权重)
    daily_score DECIMAL(6,2) DEFAULT 0,
    daily_weight DECIMAL(3,2) DEFAULT 0.80,
    daily_weighted_score DECIMAL(6,2) GENERATED ALWAYS AS (daily_score * daily_weight) STORED,
    -- 年终集体测评积分 (20%权重)
    annual_score DECIMAL(6,2) DEFAULT 0,
    annual_weight DECIMAL(3,2) DEFAULT 0.20,
    annual_weighted_score DECIMAL(6,2) GENERATED ALWAYS AS (annual_score * annual_weight) STORED,
    -- 最终总分
    final_total_score DECIMAL(6,2) GENERATED ALWAYS AS (daily_score * 0.8 + annual_score * 0.2) STORED,
    ranking INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, evaluation_year)
);

-- 5. 创建评价可见性权限表
CREATE TABLE IF NOT EXISTS evaluation_visibility_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_name VARCHAR(100) NOT NULL UNIQUE,
    setting_description TEXT,
    is_enabled BOOLEAN DEFAULT false,
    target_roles TEXT[] DEFAULT '{}', -- 目标角色数组
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认权限设置
INSERT INTO evaluation_visibility_settings (setting_name, setting_description, is_enabled, target_roles) VALUES
('daily_evaluation_visible', '普通职工可查看日常实绩评价界面', true, '{"employee"}'),
('annual_evaluation_visible', '普通职工可查看年终集体测评界面', true, '{"employee"}'),
('personal_score_visible', '普通职工可查看个人积分', true, '{"employee"}'),
('evaluation_results_visible', '评价结果对被评价人可见', false, '{"employee", "leader"}'),
('task_details_visible', '任务详情对所有人可见', true, '{"employee", "leader", "assessment_admin"}')
ON CONFLICT (setting_name) DO NOTHING;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_work_task_detailed_evaluations_task ON work_task_detailed_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_work_task_detailed_evaluations_evaluator ON work_task_detailed_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_work_task_detailed_evaluations_status ON work_task_detailed_evaluations(status);

CREATE INDEX IF NOT EXISTS idx_daily_performance_summary_user_period ON daily_performance_summary(user_id, evaluation_period);
CREATE INDEX IF NOT EXISTS idx_daily_performance_summary_period ON daily_performance_summary(evaluation_period);

CREATE INDEX IF NOT EXISTS idx_annual_collective_summary_user_year ON annual_collective_summary(user_id, evaluation_year);
CREATE INDEX IF NOT EXISTS idx_annual_collective_summary_year ON annual_collective_summary(evaluation_year);

CREATE INDEX IF NOT EXISTS idx_final_work_performance_scores_user_year ON final_work_performance_scores(user_id, evaluation_year);
CREATE INDEX IF NOT EXISTS idx_final_work_performance_scores_ranking ON final_work_performance_scores(ranking);

-- 创建更新时间触发器
CREATE TRIGGER update_work_task_detailed_evaluations_updated_at 
    BEFORE UPDATE ON work_task_detailed_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_performance_summary_updated_at 
    BEFORE UPDATE ON daily_performance_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annual_collective_summary_updated_at 
    BEFORE UPDATE ON annual_collective_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_final_work_performance_scores_updated_at 
    BEFORE UPDATE ON final_work_performance_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_visibility_settings_updated_at 
    BEFORE UPDATE ON evaluation_visibility_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE work_task_detailed_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_performance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_collective_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_work_performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_visibility_settings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 工作任务详细评价表策略
CREATE POLICY "用户可查看相关任务评价" ON work_task_detailed_evaluations
    FOR SELECT USING (
        evaluator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM work_tasks wt 
            WHERE wt.id = task_id AND wt.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

CREATE POLICY "评价人员可创建任务评价" ON work_task_detailed_evaluations
    FOR INSERT WITH CHECK (
        evaluator_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

CREATE POLICY "评价人员可更新自己的评价" ON work_task_detailed_evaluations
    FOR UPDATE USING (
        evaluator_id = auth.uid() AND status = 'pending'
    );

-- 日常实绩评价汇总表策略
CREATE POLICY "用户可查看相关日常汇总" ON daily_performance_summary
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

-- 年终集体测评汇总表策略
CREATE POLICY "用户可查看相关年终汇总" ON annual_collective_summary
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

-- 最终工作实绩积分表策略
CREATE POLICY "用户可查看相关最终积分" ON final_work_performance_scores
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

-- 评价可见性权限表策略
CREATE POLICY "管理员可管理权限设置" ON evaluation_visibility_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );

CREATE POLICY "所有用户可查看权限设置" ON evaluation_visibility_settings
    FOR SELECT USING (true);

-- 授予权限
GRANT ALL PRIVILEGES ON work_task_detailed_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON daily_performance_summary TO authenticated;
GRANT ALL PRIVILEGES ON annual_collective_summary TO authenticated;
GRANT ALL PRIVILEGES ON final_work_performance_scores TO authenticated;
GRANT ALL PRIVILEGES ON evaluation_visibility_settings TO authenticated;

GRANT SELECT ON work_task_detailed_evaluations TO anon;
GRANT SELECT ON daily_performance_summary TO anon;
GRANT SELECT ON annual_collective_summary TO anon;
GRANT SELECT ON final_work_performance_scores TO anon;
GRANT SELECT ON evaluation_visibility_settings TO anon;