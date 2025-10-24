-- 工作实绩积分模块增强
-- 添加权限设置表、评价批次管理表，并扩展现有表结构

-- 1. 创建权限设置表 (permission_settings)
-- 用于控制普通职工对日常实绩评价和年终集体测评的权限
CREATE TABLE permission_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_type VARCHAR(50) NOT NULL CHECK (permission_type IN ('daily_evaluation', 'annual_evaluation')),
    is_enabled BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(permission_type)
);

-- 2. 创建评价批次管理表 (evaluation_batches)
-- 用于管理评价的批次和周期
CREATE TABLE evaluation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(100) NOT NULL,
    evaluation_type VARCHAR(50) NOT NULL CHECK (evaluation_type IN ('daily', 'annual')),
    year INTEGER NOT NULL,
    month INTEGER CHECK (month >= 1 AND month <= 12),
    quarter INTEGER CHECK (quarter >= 1 AND quarter <= 4),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 扩展工作任务评价表，添加评价批次关联
ALTER TABLE work_task_evaluations 
ADD COLUMN batch_id UUID REFERENCES evaluation_batches(id),
ADD COLUMN evaluation_type VARCHAR(50) DEFAULT 'daily' CHECK (evaluation_type IN ('daily', 'annual')),
ADD COLUMN evaluated_user_id UUID REFERENCES users(id),
ADD COLUMN status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));

-- 4. 创建最终积分汇总表 (final_performance_scores)
-- 用于存储按照公式计算的最终积分
CREATE TABLE final_performance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluation_period VARCHAR(20) NOT NULL, -- 格式: YYYY-MM 或 YYYY
    daily_score DECIMAL(6,2) DEFAULT 0, -- 日常实绩评价平均分
    annual_score DECIMAL(6,2) DEFAULT 0, -- 年终集体测评平均分
    final_score DECIMAL(6,2) DEFAULT 0, -- 最终积分 = daily_score * 0.8 + annual_score * 0.2
    daily_evaluator_count INTEGER DEFAULT 0, -- 日常评价人数
    annual_evaluator_count INTEGER DEFAULT 0, -- 年终评价人数
    calculation_formula VARCHAR(200) DEFAULT 'daily_score * 0.8 + annual_score * 0.2',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, evaluation_period)
);

-- 创建索引
CREATE INDEX idx_permission_settings_type ON permission_settings(permission_type);
CREATE INDEX idx_permission_settings_enabled ON permission_settings(is_enabled);

CREATE INDEX idx_evaluation_batches_type ON evaluation_batches(evaluation_type);
CREATE INDEX idx_evaluation_batches_status ON evaluation_batches(status);
CREATE INDEX idx_evaluation_batches_period ON evaluation_batches(year, month);

CREATE INDEX idx_work_task_evaluations_batch ON work_task_evaluations(batch_id);
CREATE INDEX idx_work_task_evaluations_type ON work_task_evaluations(evaluation_type);
CREATE INDEX idx_work_task_evaluations_evaluated_user ON work_task_evaluations(evaluated_user_id);
CREATE INDEX idx_work_task_evaluations_status ON work_task_evaluations(status);

CREATE INDEX idx_final_performance_user_period ON final_performance_scores(user_id, evaluation_period);
CREATE INDEX idx_final_performance_period ON final_performance_scores(evaluation_period);

-- 创建更新时间触发器
CREATE TRIGGER update_permission_settings_updated_at BEFORE UPDATE ON permission_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluation_batches_updated_at BEFORE UPDATE ON evaluation_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_final_performance_scores_updated_at BEFORE UPDATE ON final_performance_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE permission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_performance_scores ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 权限设置表策略
CREATE POLICY "Everyone can view permission settings" ON permission_settings
    FOR SELECT USING (true);

CREATE POLICY "Only assessment admins can manage permission settings" ON permission_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );

-- 评价批次管理表策略
CREATE POLICY "Everyone can view evaluation batches" ON evaluation_batches
    FOR SELECT USING (true);

CREATE POLICY "Assessment admins can manage evaluation batches" ON evaluation_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );

-- 最终积分汇总表策略
CREATE POLICY "Everyone can view final performance scores" ON final_performance_scores
    FOR SELECT USING (true);

CREATE POLICY "System can manage final performance scores" ON final_performance_scores
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );

-- 授予权限
GRANT ALL PRIVILEGES ON permission_settings TO authenticated;
GRANT ALL PRIVILEGES ON evaluation_batches TO authenticated;
GRANT ALL PRIVILEGES ON final_performance_scores TO authenticated;

GRANT SELECT ON permission_settings TO anon;
GRANT SELECT ON evaluation_batches TO anon;
GRANT SELECT ON final_performance_scores TO anon;

-- 创建积分计算函数
CREATE OR REPLACE FUNCTION calculate_final_performance_scores(
    p_user_id UUID DEFAULT NULL,
    p_evaluation_period VARCHAR DEFAULT NULL
)
RETURNS TABLE(
    user_id UUID,
    evaluation_period VARCHAR,
    daily_score DECIMAL,
    annual_score DECIMAL,
    final_score DECIMAL,
    daily_evaluator_count INTEGER,
    annual_evaluator_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_scores AS (
        SELECT 
            wte.evaluated_user_id,
            TO_CHAR(wte.evaluation_date, 'YYYY-MM') as period,
            ROUND(AVG(wte.work_volume_score + wte.work_quality_score), 2) as avg_daily_score,
            COUNT(DISTINCT wte.evaluator_id) as daily_count
        FROM work_task_evaluations wte
        WHERE wte.evaluation_type = 'daily'
            AND wte.status = 'approved'
            AND (p_user_id IS NULL OR wte.evaluated_user_id = p_user_id)
            AND (p_evaluation_period IS NULL OR TO_CHAR(wte.evaluation_date, 'YYYY-MM') = p_evaluation_period)
        GROUP BY wte.evaluated_user_id, TO_CHAR(wte.evaluation_date, 'YYYY-MM')
    ),
    annual_scores AS (
        SELECT 
            wte.evaluated_user_id,
            TO_CHAR(wte.evaluation_date, 'YYYY') as period,
            ROUND(AVG(wte.work_volume_score + wte.work_quality_score), 2) as avg_annual_score,
            COUNT(DISTINCT wte.evaluator_id) as annual_count
        FROM work_task_evaluations wte
        WHERE wte.evaluation_type = 'annual'
            AND wte.status = 'approved'
            AND (p_user_id IS NULL OR wte.evaluated_user_id = p_user_id)
            AND (p_evaluation_period IS NULL OR TO_CHAR(wte.evaluation_date, 'YYYY') = p_evaluation_period)
        GROUP BY wte.evaluated_user_id, TO_CHAR(wte.evaluation_date, 'YYYY')
    )
    SELECT 
        COALESCE(ds.evaluated_user_id, as_table.evaluated_user_id) as user_id,
        COALESCE(ds.period, as_table.period) as evaluation_period,
        COALESCE(ds.avg_daily_score, 0) as daily_score,
        COALESCE(as_table.avg_annual_score, 0) as annual_score,
        ROUND(COALESCE(ds.avg_daily_score, 0) * 0.8 + COALESCE(as_table.avg_annual_score, 0) * 0.2, 2) as final_score,
        COALESCE(ds.daily_count, 0) as daily_evaluator_count,
        COALESCE(as_table.annual_count, 0) as annual_evaluator_count
    FROM daily_scores ds
    FULL OUTER JOIN annual_scores as_table ON ds.evaluated_user_id = as_table.evaluated_user_id 
        AND SUBSTRING(ds.period, 1, 4) = as_table.period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建权限检查函数
CREATE OR REPLACE FUNCTION check_evaluation_permission(
    p_permission_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    permission_enabled BOOLEAN := false;
    current_date_val DATE := CURRENT_DATE;
BEGIN
    SELECT 
        ps.is_enabled AND 
        (ps.start_date IS NULL OR ps.start_date <= current_date_val) AND
        (ps.end_date IS NULL OR ps.end_date >= current_date_val)
    INTO permission_enabled
    FROM permission_settings ps
    WHERE ps.permission_type = p_permission_type;
    
    RETURN COALESCE(permission_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 插入默认权限设置
INSERT INTO permission_settings (permission_type, is_enabled, description, created_by)
SELECT 
    'daily_evaluation',
    false,
    '日常实绩评价权限控制',
    u.id
FROM users u
WHERE u.role = 'system_admin'
LIMIT 1
ON CONFLICT (permission_type) DO NOTHING;

INSERT INTO permission_settings (permission_type, is_enabled, description, created_by)
SELECT 
    'annual_evaluation',
    false,
    '年终集体测评权限控制',
    u.id
FROM users u
WHERE u.role = 'system_admin'
LIMIT 1
ON CONFLICT (permission_type) DO NOTHING;

COMMIT;