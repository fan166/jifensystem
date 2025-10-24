-- 创建重点工作积分相关表
-- 重点工作积分模块包含：任务分配、完成状态、闭环管理

-- 1. 重点工作表 (key_works)
-- 用于记录重大项目、专项活动、难点工作等重点工作
CREATE TABLE key_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_title VARCHAR(200) NOT NULL,
    work_description TEXT,
    work_type VARCHAR(50) NOT NULL CHECK (work_type IN ('major_project', 'special_activity', 'difficult_task', 'innovation_project', 'emergency_response')),
    priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('medium', 'high', 'urgent')),
    total_score DECIMAL(5,2) DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 20),
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'completed', 'cancelled', 'on_hold')),
    start_date DATE,
    end_date DATE,
    actual_completion_date DATE,
    created_by UUID NOT NULL REFERENCES users(id),
    department_id UUID REFERENCES departments(id),
    is_cross_department BOOLEAN DEFAULT false,
    completion_rate DECIMAL(5,2) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    quality_rating VARCHAR(20) CHECK (quality_rating IN ('excellent', 'good', 'average', 'poor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 重点工作参与人员表 (key_work_participants)
-- 用于记录参与重点工作的人员及其角色和贡献
CREATE TABLE key_work_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL REFERENCES key_works(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('leader', 'main_participant', 'participant', 'supporter', 'coordinator')),
    contribution_description TEXT,
    individual_score DECIMAL(4,2) DEFAULT 0 CHECK (individual_score >= 0 AND individual_score <= 20),
    performance_rating VARCHAR(20) CHECK (performance_rating IN ('outstanding', 'excellent', 'good', 'average', 'poor')),
    assigned_date DATE DEFAULT CURRENT_DATE,
    completion_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(key_work_id, user_id)
);

-- 3. 重点工作评价表 (key_work_evaluations)
-- 用于记录对重点工作完成情况的评价
CREATE TABLE key_work_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL REFERENCES key_works(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES key_work_participants(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    innovation_score DECIMAL(3,2) DEFAULT 0 CHECK (innovation_score >= 0 AND innovation_score <= 5),
    execution_score DECIMAL(3,2) DEFAULT 0 CHECK (execution_score >= 0 AND execution_score <= 5),
    collaboration_score DECIMAL(3,2) DEFAULT 0 CHECK (collaboration_score >= 0 AND collaboration_score <= 5),
    result_score DECIMAL(3,2) DEFAULT 0 CHECK (result_score >= 0 AND result_score <= 5),
    total_score DECIMAL(4,2) DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 20),
    evaluation_comments TEXT,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 重点工作里程碑表 (key_work_milestones)
-- 用于记录重点工作的关键节点和进度
CREATE TABLE key_work_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL REFERENCES key_works(id) ON DELETE CASCADE,
    milestone_title VARCHAR(200) NOT NULL,
    milestone_description TEXT,
    planned_date DATE,
    actual_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    completion_notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_key_works_type ON key_works(work_type);
CREATE INDEX idx_key_works_status ON key_works(status);
CREATE INDEX idx_key_works_department ON key_works(department_id);
CREATE INDEX idx_key_works_created_by ON key_works(created_by);
CREATE INDEX idx_key_works_dates ON key_works(start_date, end_date);

CREATE INDEX idx_key_work_participants_work_id ON key_work_participants(key_work_id);
CREATE INDEX idx_key_work_participants_user_id ON key_work_participants(user_id);
CREATE INDEX idx_key_work_participants_role ON key_work_participants(role);
CREATE INDEX idx_key_work_participants_active ON key_work_participants(is_active);

CREATE INDEX idx_key_work_evaluations_work_id ON key_work_evaluations(key_work_id);
CREATE INDEX idx_key_work_evaluations_participant ON key_work_evaluations(participant_id);
CREATE INDEX idx_key_work_evaluations_evaluator ON key_work_evaluations(evaluator_id);
CREATE INDEX idx_key_work_evaluations_date ON key_work_evaluations(evaluation_date);

CREATE INDEX idx_key_work_milestones_work_id ON key_work_milestones(key_work_id);
CREATE INDEX idx_key_work_milestones_status ON key_work_milestones(status);
CREATE INDEX idx_key_work_milestones_dates ON key_work_milestones(planned_date, actual_date);

-- 创建更新时间触发器
CREATE TRIGGER update_key_works_updated_at BEFORE UPDATE ON key_works
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_work_participants_updated_at BEFORE UPDATE ON key_work_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_work_evaluations_updated_at BEFORE UPDATE ON key_work_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_work_milestones_updated_at BEFORE UPDATE ON key_work_milestones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE key_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_work_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_work_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_work_milestones ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 重点工作表策略
CREATE POLICY "Users can view all key works" ON key_works
    FOR SELECT USING (true);

CREATE POLICY "Leaders can manage key works" ON key_works
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role IN ('system_admin', 'assessment_admin', 'leader'))
        )
    );

CREATE POLICY "Creators can manage their key works" ON key_works
    FOR ALL USING (auth.uid() = created_by);

-- 重点工作参与人员表策略
CREATE POLICY "Users can view all participants" ON key_work_participants
    FOR SELECT USING (true);

CREATE POLICY "Leaders can manage participants" ON key_work_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role IN ('system_admin', 'assessment_admin', 'leader'))
        )
    );

CREATE POLICY "Work creators can manage participants" ON key_work_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM key_works 
            WHERE key_works.id = key_work_participants.key_work_id 
            AND key_works.created_by = auth.uid()
        )
    );

-- 重点工作评价表策略
CREATE POLICY "Users can view all evaluations" ON key_work_evaluations
    FOR SELECT USING (true);

CREATE POLICY "Evaluators can insert evaluations" ON key_work_evaluations
    FOR INSERT WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Evaluators can update their evaluations" ON key_work_evaluations
    FOR UPDATE USING (auth.uid() = evaluator_id);

-- 里程碑表策略
CREATE POLICY "Users can view all milestones" ON key_work_milestones
    FOR SELECT USING (true);

CREATE POLICY "Leaders can manage milestones" ON key_work_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND (users.role IN ('system_admin', 'assessment_admin', 'leader'))
        )
    );

CREATE POLICY "Work creators can manage milestones" ON key_work_milestones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM key_works 
            WHERE key_works.id = key_work_milestones.key_work_id 
            AND key_works.created_by = auth.uid()
        )
    );

-- 授予权限
GRANT ALL PRIVILEGES ON key_works TO authenticated;
GRANT ALL PRIVILEGES ON key_work_participants TO authenticated;
GRANT ALL PRIVILEGES ON key_work_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON key_work_milestones TO authenticated;

GRANT SELECT ON key_works TO anon;
GRANT SELECT ON key_work_participants TO anon;
GRANT SELECT ON key_work_evaluations TO anon;
GRANT SELECT ON key_work_milestones TO anon;