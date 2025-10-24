-- 文件名: 027_create_evaluation_batches.sql
-- 创建评价批次表，用于管理评价活动的批次和周期

CREATE TABLE evaluation_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(200) NOT NULL,
    evaluation_type VARCHAR(20) NOT NULL CHECK (evaluation_type IN ('daily', 'annual')),
    period VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    target_users JSONB DEFAULT '[]'::jsonb,
    evaluator_users JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_evaluation_batches_type ON evaluation_batches(evaluation_type);
CREATE INDEX idx_evaluation_batches_period ON evaluation_batches(period);
CREATE INDEX idx_evaluation_batches_status ON evaluation_batches(status);
CREATE INDEX idx_evaluation_batches_dates ON evaluation_batches(start_date, end_date);
CREATE INDEX idx_evaluation_batches_created_by ON evaluation_batches(created_by);

-- 创建更新时间触发器
CREATE TRIGGER update_evaluation_batches_updated_at 
    BEFORE UPDATE ON evaluation_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE evaluation_batches ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
CREATE POLICY "管理员可管理评价批次" ON evaluation_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        )
    );

CREATE POLICY "所有用户可查看活跃批次" ON evaluation_batches
    FOR SELECT USING (status = 'active');

CREATE POLICY "评价人员可查看相关批次" ON evaluation_batches
    FOR SELECT USING (
        evaluator_users ? auth.uid()::text OR
        target_users ? auth.uid()::text
    );

-- 授予权限
GRANT ALL PRIVILEGES ON evaluation_batches TO authenticated;
GRANT SELECT ON evaluation_batches TO anon;