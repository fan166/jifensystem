-- 创建缺失的积分模块表结构
-- 基于技术架构文档补充必要的表

-- 工作任务表 (用于工作实绩积分模块)
CREATE TABLE IF NOT EXISTS work_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    task_type VARCHAR(50) NOT NULL CHECK (task_type IN ('daily', 'project', 'special')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    score_value DECIMAL(5,2) DEFAULT 0,
    evaluation_count INTEGER DEFAULT 0,
    average_score DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_work_tasks_assigned_to ON work_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_tasks_status ON work_tasks(status);
CREATE INDEX IF NOT EXISTS idx_work_tasks_type ON work_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_work_tasks_due_date ON work_tasks(due_date);

-- 重点工作表 (用于重点工作积分模块)
CREATE TABLE IF NOT EXISTS key_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    work_type VARCHAR(50) NOT NULL CHECK (work_type IN ('project', 'activity', 'inspection', 'emergency')),
    priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'cancelled')),
    start_date DATE,
    end_date DATE,
    total_score DECIMAL(5,2) DEFAULT 20,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_key_works_status ON key_works(status);
CREATE INDEX IF NOT EXISTS idx_key_works_type ON key_works(work_type);
CREATE INDEX IF NOT EXISTS idx_key_works_created_by ON key_works(created_by);

-- 重点工作参与人员表
CREATE TABLE IF NOT EXISTS key_work_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL REFERENCES key_works(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'participant' CHECK (role IN ('leader', 'participant', 'supporter')),
    participation_score DECIMAL(5,2) DEFAULT 0,
    completion_status VARCHAR(20) DEFAULT 'assigned' CHECK (completion_status IN ('assigned', 'in_progress', 'completed', 'not_completed')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(key_work_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_key_work_participants_work_id ON key_work_participants(key_work_id);
CREATE INDEX IF NOT EXISTS idx_key_work_participants_user_id ON key_work_participants(user_id);

-- 绩效奖励积分表 (用于绩效奖励积分模块)
CREATE TABLE IF NOT EXISTS performance_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    bonus_type VARCHAR(50) NOT NULL CHECK (bonus_type IN ('commendation', 'advanced', 'special', 'innovation')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    score_value DECIMAL(5,2) NOT NULL,
    award_level VARCHAR(50) CHECK (award_level IN ('national', 'provincial', 'municipal', 'departmental', 'internal')),
    award_date DATE,
    created_by UUID NOT NULL REFERENCES users(id),
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_performance_bonuses_user_id ON performance_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_bonuses_type ON performance_bonuses(bonus_type);
CREATE INDEX IF NOT EXISTS idx_performance_bonuses_award_date ON performance_bonuses(award_date DESC);

-- 工作实绩评价表 (用于集体评分机制)
CREATE TABLE IF NOT EXISTS work_task_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 10),
    comments TEXT,
    evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, evaluator_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_work_task_evaluations_task_id ON work_task_evaluations(task_id);
CREATE INDEX IF NOT EXISTS idx_work_task_evaluations_evaluator_id ON work_task_evaluations(evaluator_id);

-- 基本职责积分导入批次表 (用于批量导入)
CREATE TABLE IF NOT EXISTS basic_duty_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_name VARCHAR(200) NOT NULL,
    import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('attendance', 'learning', 'discipline')),
    file_name VARCHAR(255),
    total_records INTEGER DEFAULT 0,
    success_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    imported_by UUID NOT NULL REFERENCES users(id),
    import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_basic_duty_import_batches_type ON basic_duty_import_batches(import_type);
CREATE INDEX IF NOT EXISTS idx_basic_duty_import_batches_date ON basic_duty_import_batches(import_date DESC);

-- 基本职责积分历史表 (用于记录修改历史)
CREATE TABLE IF NOT EXISTS basic_duty_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    basic_duty_score_id UUID NOT NULL REFERENCES basic_duty_scores(id),
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_basic_duty_score_history_score_id ON basic_duty_score_history(basic_duty_score_id);
CREATE INDEX IF NOT EXISTS idx_basic_duty_score_history_changed_at ON basic_duty_score_history(changed_at DESC);

-- 最终绩效得分表 (用于年终考核)
CREATE TABLE IF NOT EXISTS final_performance_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    evaluation_period VARCHAR(20) NOT NULL, -- 如 '2024-Q1', '2024-annual'
    basic_duty_score DECIMAL(5,2) DEFAULT 0,
    performance_score DECIMAL(5,2) DEFAULT 0,
    key_work_score DECIMAL(5,2) DEFAULT 0,
    bonus_score DECIMAL(5,2) DEFAULT 0,
    total_score DECIMAL(6,2) DEFAULT 0,
    ranking INTEGER,
    performance_level VARCHAR(20) CHECK (performance_level IN ('excellent', 'good', 'qualified', 'unqualified')),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculated_by UUID REFERENCES users(id),
    UNIQUE(user_id, evaluation_period)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_user_id ON final_performance_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_period ON final_performance_scores(evaluation_period);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_total ON final_performance_scores(total_score DESC);

-- 添加更新时间戳触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加更新时间戳触发器
DROP TRIGGER IF EXISTS update_work_tasks_updated_at ON work_tasks;
CREATE TRIGGER update_work_tasks_updated_at
    BEFORE UPDATE ON work_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_key_works_updated_at ON key_works;
CREATE TRIGGER update_key_works_updated_at
    BEFORE UPDATE ON key_works
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_bonuses_updated_at ON performance_bonuses;
CREATE TRIGGER update_performance_bonuses_updated_at
    BEFORE UPDATE ON performance_bonuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();