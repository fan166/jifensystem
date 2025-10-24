-- 文件名: 028_extend_performance_evaluations.sql
-- 扩展现有的performance_evaluations表，添加新字段支持批次管理和匿名评价

-- 添加新字段
ALTER TABLE performance_evaluations 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES evaluation_batches(id),
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS evaluation_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS weight_factor DECIMAL(3,2) DEFAULT 1.00 CHECK (weight_factor >= 0 AND weight_factor <= 1),
ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_batch ON performance_evaluations(batch_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_anonymous ON performance_evaluations(is_anonymous);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_round ON performance_evaluations(evaluation_round);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_reviewer ON performance_evaluations(reviewer_id);

-- 更新现有RLS策略
DROP POLICY IF EXISTS "评价人员可创建评价记录" ON performance_evaluations;
DROP POLICY IF EXISTS "用户可查看相关评价记录" ON performance_evaluations;

-- 创建新的RLS策略
CREATE POLICY "评价人员可创建评价记录" ON performance_evaluations
    FOR INSERT WITH CHECK (
        auth.uid() = evaluator_id AND
        (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND users.role IN ('system_admin', 'assessment_admin', 'leader')
            ) OR
            EXISTS (
                SELECT 1 FROM evaluation_batches eb
                WHERE eb.id = batch_id 
                AND eb.evaluator_users ? auth.uid()::text
                AND eb.status = 'active'
            )
        )
    );

CREATE POLICY "用户可查看相关评价记录" ON performance_evaluations
    FOR SELECT USING (
        user_id = auth.uid() OR 
        evaluator_id = auth.uid() OR
        reviewer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin', 'leader')
        ) OR
        (
            is_anonymous = false AND
            EXISTS (
                SELECT 1 FROM permission_settings ps
                WHERE ps.setting_key = 'evaluation_result_visible'
                AND ps.is_enabled = true
            )
        )
    );

CREATE POLICY "评价人员可更新自己的评价" ON performance_evaluations
    FOR UPDATE USING (
        evaluator_id = auth.uid() AND
        status IN ('draft', 'submitted')
    );

CREATE POLICY "审核人员可审核评价记录" ON performance_evaluations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('system_admin', 'assessment_admin')
        )
    );