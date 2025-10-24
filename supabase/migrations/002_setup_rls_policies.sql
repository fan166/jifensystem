-- 积分制绩效管理系统 - RLS策略和权限设置
-- 创建时间: 2024-01-20
-- 描述: 设置行级安全策略和用户权限

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE basic_duty_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_work_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_bonuses ENABLE ROW LEVEL SECURITY;

-- 为匿名用户授予基本读取权限
GRANT SELECT ON departments TO anon;
GRANT SELECT ON score_types TO anon;

-- 为认证用户授予完整权限
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT ALL PRIVILEGES ON departments TO authenticated;
GRANT ALL PRIVILEGES ON scores TO authenticated;
GRANT ALL PRIVILEGES ON score_types TO authenticated;
GRANT ALL PRIVILEGES ON basic_duty_scores TO authenticated;
GRANT ALL PRIVILEGES ON work_tasks TO authenticated;
GRANT ALL PRIVILEGES ON performance_evaluations TO authenticated;
GRANT ALL PRIVILEGES ON key_works TO authenticated;
GRANT ALL PRIVILEGES ON key_work_participants TO authenticated;
GRANT ALL PRIVILEGES ON performance_bonuses TO authenticated;

-- 部门表RLS策略（所有认证用户可读）
CREATE POLICY "departments_select_policy" ON departments
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "departments_insert_policy" ON departments
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "departments_update_policy" ON departments
    FOR UPDATE TO authenticated
    USING (true);

-- 用户表RLS策略
CREATE POLICY "users_select_policy" ON users
    FOR SELECT TO authenticated
    USING (true); -- 所有认证用户可以查看所有用户信息

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT TO authenticated
    WITH CHECK (true); -- 管理员可以创建用户

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid() OR -- 用户可以更新自己的信息
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 管理员可以更新所有用户
    );

-- 积分记录表RLS策略
CREATE POLICY "scores_select_policy" ON scores
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR -- 用户可以查看自己的积分
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以查看所有积分
    );

CREATE POLICY "scores_insert_policy" ON scores
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以录入积分
    );

CREATE POLICY "scores_update_policy" ON scores
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以修改积分
    );

-- 基本职责积分表RLS策略
CREATE POLICY "basic_duty_scores_select_policy" ON basic_duty_scores
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR -- 用户可以查看自己的基本职责积分
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以查看所有基本职责积分
    );

CREATE POLICY "basic_duty_scores_insert_policy" ON basic_duty_scores
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以录入基本职责积分
    );

CREATE POLICY "basic_duty_scores_update_policy" ON basic_duty_scores
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以修改基本职责积分
    );

-- 工作任务表RLS策略
CREATE POLICY "work_tasks_select_policy" ON work_tasks
    FOR SELECT TO authenticated
    USING (true); -- 所有人可以查看工作任务

CREATE POLICY "work_tasks_insert_policy" ON work_tasks
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid() OR -- 用户可以创建自己的任务
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以为他人创建任务
    );

CREATE POLICY "work_tasks_update_policy" ON work_tasks
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid() OR -- 用户可以更新自己的任务
        created_by = auth.uid() OR -- 创建者可以更新任务
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以更新所有任务
    );

-- 工作实绩评价表RLS策略
CREATE POLICY "performance_evaluations_select_policy" ON performance_evaluations
    FOR SELECT TO authenticated
    USING (true); -- 所有人可以查看评价结果

CREATE POLICY "performance_evaluations_insert_policy" ON performance_evaluations
    FOR INSERT TO authenticated
    WITH CHECK (
        evaluator_id = auth.uid() -- 只能以自己的身份进行评价
    );

CREATE POLICY "performance_evaluations_update_policy" ON performance_evaluations
    FOR UPDATE TO authenticated
    USING (
        evaluator_id = auth.uid() OR -- 评价者可以修改自己的评价
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 管理员可以修改所有评价
    );

-- 重点工作表RLS策略
CREATE POLICY "key_works_select_policy" ON key_works
    FOR SELECT TO authenticated
    USING (true); -- 所有人可以查看重点工作

CREATE POLICY "key_works_insert_policy" ON key_works
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 只有管理员和领导可以创建重点工作
    );

CREATE POLICY "key_works_update_policy" ON key_works
    FOR UPDATE TO authenticated
    USING (
        assigned_by = auth.uid() OR -- 分配者可以更新
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以更新所有重点工作
    );

-- 重点工作参与人员表RLS策略
CREATE POLICY "key_work_participants_select_policy" ON key_work_participants
    FOR SELECT TO authenticated
    USING (true); -- 所有人可以查看参与情况

CREATE POLICY "key_work_participants_insert_policy" ON key_work_participants
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 只有管理员和领导可以分配参与人员
    );

CREATE POLICY "key_work_participants_update_policy" ON key_work_participants
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid() OR -- 参与者可以更新自己的完成状态
        EXISTS (
            SELECT 1 FROM key_works kw 
            WHERE kw.id = key_work_id AND kw.assigned_by = auth.uid()
        ) OR -- 分配者可以更新
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles) OR 'leader' = ANY(u.roles))
        ) -- 管理员和领导可以更新所有参与状态
    );

-- 绩效奖励积分表RLS策略
CREATE POLICY "performance_bonuses_select_policy" ON performance_bonuses
    FOR SELECT TO authenticated
    USING (true); -- 所有人可以查看绩效奖励积分

CREATE POLICY "performance_bonuses_insert_policy" ON performance_bonuses
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以录入绩效奖励积分
    );

CREATE POLICY "performance_bonuses_update_policy" ON performance_bonuses
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() 
            AND ('system_admin' = ANY(u.roles) OR 'assessment_admin' = ANY(u.roles))
        ) -- 只有管理员可以修改绩效奖励积分
    );