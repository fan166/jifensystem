-- 创建工作实绩评价记录表
CREATE TABLE IF NOT EXISTS performance_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- 格式: YYYY-MM
    evaluation_type VARCHAR(10) NOT NULL CHECK (evaluation_type IN ('daily', 'annual')),
    work_volume_score DECIMAL(4,1) NOT NULL DEFAULT 0 CHECK (work_volume_score >= 0 AND work_volume_score <= 30),
    work_quality_score DECIMAL(4,1) NOT NULL DEFAULT 0 CHECK (work_quality_score >= 0 AND work_quality_score <= 20),
    total_score DECIMAL(4,1) NOT NULL DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 50),
    comments TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建最终工作实绩积分统计表
CREATE TABLE IF NOT EXISTS final_performance_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(7) NOT NULL, -- 格式: YYYY-MM
    daily_score DECIMAL(4,1) NOT NULL DEFAULT 0, -- 日常实绩评价积分
    annual_score DECIMAL(4,1) NOT NULL DEFAULT 0, -- 年终集体测评积分
    final_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 最终积分 = daily_score * 0.8 + annual_score * 0.2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_user_period ON performance_evaluations(user_id, period);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluator ON performance_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_type ON performance_evaluations(evaluation_type);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_status ON performance_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_user_period ON final_performance_scores(user_id, period);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_performance_evaluations_updated_at
    BEFORE UPDATE ON performance_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_final_performance_scores_updated_at
    BEFORE UPDATE ON final_performance_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_performance_scores ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- performance_evaluations表的策略
CREATE POLICY "Users can view performance evaluations" ON performance_evaluations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own evaluations" ON performance_evaluations
    FOR INSERT WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Users can update their own draft evaluations" ON performance_evaluations
    FOR UPDATE USING (auth.uid() = evaluator_id AND status = 'draft');

CREATE POLICY "Managers can update submitted evaluations" ON performance_evaluations
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Users can delete their own draft evaluations" ON performance_evaluations
    FOR DELETE USING (auth.uid() = evaluator_id AND status = 'draft');

-- final_performance_scores表的策略
CREATE POLICY "Users can view final performance scores" ON final_performance_scores
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage final performance scores" ON final_performance_scores
    FOR ALL USING (auth.role() = 'authenticated');

-- 授予权限
GRANT ALL PRIVILEGES ON performance_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON final_performance_scores TO authenticated;
GRANT SELECT ON performance_evaluations TO anon;
GRANT SELECT ON final_performance_scores TO anon;

-- 插入一些示例数据（可选）
-- INSERT INTO performance_evaluations (user_id, evaluator_id, period, evaluation_type, work_volume_score, work_quality_score, total_score, status)
-- VALUES 
--     ((SELECT id FROM users WHERE email = 'user1@example.com' LIMIT 1), 
--      (SELECT id FROM users WHERE role = 'manager' LIMIT 1), 
--      '2024-01', 'daily', 25.0, 18.0, 43.0, 'approved'),
--     ((SELECT id FROM users WHERE email = 'user1@example.com' LIMIT 1), 
--      (SELECT id FROM users WHERE role = 'manager' LIMIT 1), 
--      '2024-01', 'annual', 28.0, 19.0, 47.0, 'approved');

COMMIT;