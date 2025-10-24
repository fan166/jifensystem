-- 创建工作实绩积分相关表
-- 工作实绩积分模块包含：任务报备、日常评价、年终测评

-- 1. 工作任务表 (work_tasks)
-- 用于记录工作任务的报备和完成情况
CREATE TABLE work_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_title VARCHAR(200) NOT NULL,
    task_description TEXT,
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('daily', 'weekly', 'monthly', 'project', 'emergency')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    expected_score DECIMAL(5,2) DEFAULT 0 CHECK (expected_score >= 0 AND expected_score <= 50),
    actual_score DECIMAL(5,2) DEFAULT 0 CHECK (actual_score >= 0 AND actual_score <= 50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue')),
    start_date DATE,
    due_date DATE,
    completion_date DATE,
    assigned_by UUID REFERENCES users(id),
    department_id UUID REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 工作任务评价表 (work_task_evaluations)
-- 用于记录对工作任务完成情况的评价
CREATE TABLE work_task_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    work_volume_score DECIMAL(4,2) DEFAULT 0 CHECK (work_volume_score >= 0 AND work_volume_score <= 30),
    work_quality_score DECIMAL(4,2) DEFAULT 0 CHECK (work_quality_score >= 0 AND work_quality_score <= 20),
    total_score DECIMAL(4,2) DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 50),
    evaluation_comments TEXT,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 工作实绩月度汇总表 (monthly_performance_summary)
-- 用于汇总每月的工作实绩积分
CREATE TABLE monthly_performance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_work_volume_score DECIMAL(6,2) DEFAULT 0,
    total_work_quality_score DECIMAL(6,2) DEFAULT 0,
    monthly_total_score DECIMAL(6,2) DEFAULT 0,
    completion_rate DECIMAL(5,2) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, year, month)
);

-- 创建索引
CREATE INDEX idx_work_tasks_user_id ON work_tasks(user_id);
CREATE INDEX idx_work_tasks_status ON work_tasks(status);
CREATE INDEX idx_work_tasks_type ON work_tasks(task_type);
CREATE INDEX idx_work_tasks_due_date ON work_tasks(due_date);
CREATE INDEX idx_work_tasks_department ON work_tasks(department_id);

CREATE INDEX idx_work_task_evaluations_task_id ON work_task_evaluations(task_id);
CREATE INDEX idx_work_task_evaluations_evaluator ON work_task_evaluations(evaluator_id);
CREATE INDEX idx_work_task_evaluations_date ON work_task_evaluations(evaluation_date);

CREATE INDEX idx_monthly_performance_user_period ON monthly_performance_summary(user_id, year, month);
CREATE INDEX idx_monthly_performance_period ON monthly_performance_summary(year, month);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_tasks_updated_at BEFORE UPDATE ON work_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_task_evaluations_updated_at BEFORE UPDATE ON work_task_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_performance_summary_updated_at BEFORE UPDATE ON monthly_performance_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_performance_summary ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 工作任务表策略
CREATE POLICY "Users can view all work tasks" ON work_tasks
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own work tasks" ON work_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work tasks" ON work_tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Leaders can manage all work tasks" ON work_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role IN ('system_admin', 'assessment_admin', 'leader'))
        )
    );

-- 工作任务评价表策略
CREATE POLICY "Users can view all task evaluations" ON work_task_evaluations
    FOR SELECT USING (true);

CREATE POLICY "Evaluators can insert evaluations" ON work_task_evaluations
    FOR INSERT WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Evaluators can update their own evaluations" ON work_task_evaluations
    FOR UPDATE USING (auth.uid() = evaluator_id);

-- 月度汇总表策略
CREATE POLICY "Users can view all monthly summaries" ON monthly_performance_summary
    FOR SELECT USING (true);

CREATE POLICY "System can manage monthly summaries" ON monthly_performance_summary
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role IN ('system_admin', 'assessment_admin'))
        )
    );

-- 授予权限
GRANT ALL PRIVILEGES ON work_tasks TO authenticated;
GRANT ALL PRIVILEGES ON work_task_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON monthly_performance_summary TO authenticated;

GRANT SELECT ON work_tasks TO anon;
GRANT SELECT ON work_task_evaluations TO anon;
GRANT SELECT ON monthly_performance_summary TO anon;