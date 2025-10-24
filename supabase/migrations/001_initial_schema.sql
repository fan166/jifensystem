-- 创建部门表
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    department_id UUID REFERENCES departments(id),
    role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建积分类型表
CREATE TABLE score_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    max_score DECIMAL(5,2),
    min_score DECIMAL(5,2),
    description TEXT
);

-- 创建积分表
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    score_type_id VARCHAR(50) NOT NULL REFERENCES score_types(id),
    score DECIMAL(5,2) NOT NULL,
    reason TEXT,
    recorder_id UUID REFERENCES users(id),
    period VARCHAR(20) DEFAULT to_char(NOW(), 'YYYY-MM'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建评价表
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    evaluator_id UUID NOT NULL REFERENCES users(id),
    period VARCHAR(20) NOT NULL,
    total_score DECIMAL(8,2) NOT NULL,
    rank INTEGER,
    comments TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建奖励表
CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('promotion', 'bonus', 'recognition', 'training')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    amount DECIMAL(10,2),
    period VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_type_id ON scores(score_type_id);
CREATE INDEX idx_scores_period ON scores(period);
CREATE INDEX idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX idx_evaluations_user_id ON evaluations(user_id);
CREATE INDEX idx_evaluations_evaluator_id ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_period ON evaluations(period);
CREATE INDEX idx_rewards_user_id ON rewards(user_id);
CREATE INDEX idx_rewards_period ON rewards(period);

-- 初始化部门数据
INSERT INTO departments (name, description) VALUES
('考核办公室', '负责绩效考核工作的统计汇总、督查通报'),
('养护科', '负责公路养护相关工作'),
('工程科', '负责工程建设相关工作'),
('办公室', '负责行政管理相关工作');

-- 初始化积分类型数据
INSERT INTO score_types (id, name, category, max_score, min_score, description) VALUES
('attendance', '考勤管理', 'basic_duty', 5, -5, '考核上班迟到、早退、旷工情况'),
('learning', '基础学习', 'basic_duty', 5, 0, '考核参加学习培训情况'),
('discipline', '工作纪律', 'basic_duty', 10, -10, '考核工作作风、纪律执行情况'),
('work_performance', '工作实绩', 'work_performance', 50, 0, '考核工作任务量和完成质效'),
('key_work', '重点工作', 'key_work', 20, 0, '考核重大项目和专项活动参与情况'),
('performance_bonus', '绩效奖励', 'performance_bonus', 20, 0, '表彰加分、先进加分等奖励积分');

-- 创建积分统计函数
CREATE OR REPLACE FUNCTION get_user_score_summary(user_uuid UUID, score_period VARCHAR DEFAULT NULL)
RETURNS TABLE(
    basic_duty_score DECIMAL,
    work_performance_score DECIMAL,
    key_work_score DECIMAL,
    performance_bonus_score DECIMAL,
    total_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN st.category = 'basic_duty' THEN s.score ELSE 0 END), 0) as basic_duty_score,
        COALESCE(SUM(CASE WHEN st.category = 'work_performance' THEN s.score ELSE 0 END), 0) as work_performance_score,
        COALESCE(SUM(CASE WHEN st.category = 'key_work' THEN s.score ELSE 0 END), 0) as key_work_score,
        COALESCE(SUM(CASE WHEN st.category = 'performance_bonus' THEN s.score ELSE 0 END), 0) as performance_bonus_score,
        COALESCE(SUM(s.score), 0) as total_score
    FROM scores s
    JOIN score_types st ON s.score_type_id = st.id
    WHERE s.user_id = user_uuid
    AND (score_period IS NULL OR s.period = score_period);
END;
$$ LANGUAGE plpgsql;

-- 创建排名统计函数
CREATE OR REPLACE FUNCTION get_score_ranking(score_period VARCHAR DEFAULT NULL)
RETURNS TABLE(
    user_id UUID,
    user_name VARCHAR,
    department_name VARCHAR,
    total_score DECIMAL,
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_scores AS (
        SELECT 
            u.id as user_id,
            u.name as user_name,
            d.name as department_name,
            COALESCE(SUM(s.score), 0) as total_score
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN scores s ON u.id = s.user_id AND (score_period IS NULL OR s.period = score_period)
        GROUP BY u.id, u.name, d.name
    )
    SELECT 
        us.user_id,
        us.user_name,
        us.department_name,
        us.total_score,
        ROW_NUMBER() OVER (ORDER BY us.total_score DESC)::INTEGER as rank
    FROM user_scores us
    ORDER BY us.total_score DESC;
END;
$$ LANGUAGE plpgsql;

-- 启用行级安全策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 用户表策略
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);
CREATE POLICY "Admins can manage users" ON users FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
));

-- 部门表策略
CREATE POLICY "Everyone can view departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Admins can manage departments" ON departments FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
));

-- 积分类型表策略
CREATE POLICY "Everyone can view score types" ON score_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage score types" ON score_types FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
));

-- 积分表策略
CREATE POLICY "Users can view all scores" ON scores FOR SELECT USING (true);
CREATE POLICY "Managers can manage scores" ON scores FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('admin', 'manager')
));

-- 评价表策略
CREATE POLICY "Users can view evaluations" ON evaluations FOR SELECT USING (true);
CREATE POLICY "Users can create evaluations" ON evaluations FOR INSERT WITH CHECK (auth.uid()::text = evaluator_id::text);
CREATE POLICY "Users can update own evaluations" ON evaluations FOR UPDATE USING (auth.uid()::text = evaluator_id::text);
CREATE POLICY "Admins can manage evaluations" ON evaluations FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
));

-- 奖励表策略
CREATE POLICY "Users can view rewards" ON rewards FOR SELECT USING (true);
CREATE POLICY "Managers can manage rewards" ON rewards FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('admin', 'manager')
));