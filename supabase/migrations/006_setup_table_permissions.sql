-- 为新创建的积分模块表设置RLS策略和权限

-- 启用行级安全
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_work_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_task_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE basic_duty_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE basic_duty_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_performance_scores ENABLE ROW LEVEL SECURITY;

-- 为匿名用户和认证用户授予基本权限
GRANT SELECT ON work_tasks TO anon;
GRANT SELECT ON key_works TO anon;
GRANT SELECT ON key_work_participants TO anon;
GRANT SELECT ON performance_bonuses TO anon;
GRANT SELECT ON work_task_evaluations TO anon;
GRANT SELECT ON basic_duty_import_batches TO anon;
GRANT SELECT ON basic_duty_score_history TO anon;
GRANT SELECT ON final_performance_scores TO anon;

GRANT ALL PRIVILEGES ON work_tasks TO authenticated;
GRANT ALL PRIVILEGES ON key_works TO authenticated;
GRANT ALL PRIVILEGES ON key_work_participants TO authenticated;
GRANT ALL PRIVILEGES ON performance_bonuses TO authenticated;
GRANT ALL PRIVILEGES ON work_task_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON basic_duty_import_batches TO authenticated;
GRANT ALL PRIVILEGES ON basic_duty_score_history TO authenticated;
GRANT ALL PRIVILEGES ON final_performance_scores TO authenticated;

-- 工作任务表的RLS策略
-- 用户可以查看分配给自己的任务
CREATE POLICY "Users can view their own tasks" ON work_tasks
    FOR SELECT USING (assigned_to = auth.uid());

-- 用户可以更新自己的任务状态
CREATE POLICY "Users can update their own tasks" ON work_tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- 领导可以创建和分配任务
CREATE POLICY "Leaders can manage tasks" ON work_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('leader' = ANY(roles) OR 'system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 重点工作表的RLS策略
-- 所有认证用户可以查看重点工作
CREATE POLICY "All users can view key works" ON key_works
    FOR SELECT USING (auth.role() = 'authenticated');

-- 领导可以创建和管理重点工作
CREATE POLICY "Leaders can manage key works" ON key_works
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('leader' = ANY(roles) OR 'system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 重点工作参与人员表的RLS策略
-- 用户可以查看自己参与的重点工作
CREATE POLICY "Users can view their participation" ON key_work_participants
    FOR SELECT USING (user_id = auth.uid());

-- 用户可以更新自己的参与状态
CREATE POLICY "Users can update their participation status" ON key_work_participants
    FOR UPDATE USING (user_id = auth.uid());

-- 领导可以管理所有参与记录
CREATE POLICY "Leaders can manage all participations" ON key_work_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('leader' = ANY(roles) OR 'system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 绩效奖励积分表的RLS策略
-- 所有用户可以查看可见的奖励记录
CREATE POLICY "All users can view visible bonuses" ON performance_bonuses
    FOR SELECT USING (is_visible = true);

-- 用户可以查看自己的所有奖励记录
CREATE POLICY "Users can view their own bonuses" ON performance_bonuses
    FOR SELECT USING (user_id = auth.uid());

-- 管理员可以管理所有奖励记录
CREATE POLICY "Admins can manage all bonuses" ON performance_bonuses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 工作实绩评价表的RLS策略
-- 用户可以查看对自己任务的评价
CREATE POLICY "Users can view evaluations of their tasks" ON work_task_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM work_tasks 
            WHERE id = task_id AND assigned_to = auth.uid()
        )
    );

-- 用户可以评价他人的任务
CREATE POLICY "Users can evaluate others' tasks" ON work_task_evaluations
    FOR INSERT WITH CHECK (evaluator_id = auth.uid());

-- 用户可以更新自己的评价
CREATE POLICY "Users can update their own evaluations" ON work_task_evaluations
    FOR UPDATE USING (evaluator_id = auth.uid());

-- 管理员可以查看所有评价
CREATE POLICY "Admins can view all evaluations" ON work_task_evaluations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 基本职责积分导入批次表的RLS策略
-- 管理员可以管理所有导入批次
CREATE POLICY "Admins can manage import batches" ON basic_duty_import_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 基本职责积分历史表的RLS策略
-- 用户可以查看自己积分的修改历史
CREATE POLICY "Users can view their score history" ON basic_duty_score_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM basic_duty_scores 
            WHERE id = basic_duty_score_id AND user_id = auth.uid()
        )
    );

-- 管理员可以查看所有积分历史
CREATE POLICY "Admins can view all score history" ON basic_duty_score_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 最终绩效得分表的RLS策略
-- 用户可以查看自己的最终绩效得分
CREATE POLICY "Users can view their own final scores" ON final_performance_scores
    FOR SELECT USING (user_id = auth.uid());

-- 管理员可以管理所有最终绩效得分
CREATE POLICY "Admins can manage all final scores" ON final_performance_scores
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );

-- 领导可以查看所有最终绩效得分
CREATE POLICY "Leaders can view all final scores" ON final_performance_scores
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND ('leader' = ANY(roles) OR 'system_admin' = ANY(roles) OR 'assessment_admin' = ANY(roles))
        )
    );