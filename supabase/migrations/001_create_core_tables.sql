-- 积分制绩效管理系统 - 核心数据表创建
-- 创建时间: 2024-01-20
-- 描述: 创建用户、部门、积分等核心业务表

-- 1. 创建部门表
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES departments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    department_id UUID REFERENCES departments(id),
    roles TEXT[] DEFAULT '{"employee"}', -- 支持多重角色
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 创建积分类型表
CREATE TABLE score_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- basic_duty, performance, key_work, bonus
    max_score DECIMAL(5,2),
    min_score DECIMAL(5,2) DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 创建积分记录表
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_type VARCHAR(50) NOT NULL REFERENCES score_types(id),
    score_value DECIMAL(5,2) NOT NULL,
    reason TEXT,
    period VARCHAR(20), -- 考核周期，如 "2024-01"
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 创建基本职责积分详细表
CREATE TABLE basic_duty_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL, -- 考核周期
    attendance_score DECIMAL(3,2) DEFAULT 5.00, -- 考勤管理 0-5分
    learning_score DECIMAL(3,2) DEFAULT 5.00,   -- 基础学习 0-5分
    discipline_score DECIMAL(4,2) DEFAULT 10.00, -- 工作纪律 0-10分
    total_score DECIMAL(4,2) GENERATED ALWAYS AS (attendance_score + learning_score + discipline_score) STORED,
    attendance_deductions JSONB DEFAULT '[]', -- 考勤扣分记录
    learning_deductions JSONB DEFAULT '[]',   -- 学习扣分记录
    discipline_deductions JSONB DEFAULT '[]', -- 纪律扣分记录
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period)
);

-- 6. 创建工作任务表
CREATE TABLE work_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) DEFAULT 'daily', -- daily, project, special
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    start_date DATE,
    end_date DATE,
    completion_date DATE,
    work_load INTEGER DEFAULT 1, -- 工作量权重
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 创建工作实绩评价表
CREATE TABLE performance_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id),
    evaluated_id UUID NOT NULL REFERENCES users(id),
    work_quantity_score DECIMAL(4,2) DEFAULT 0, -- 工作任务量评分 0-30分
    work_quality_score DECIMAL(4,2) DEFAULT 0,  -- 工作完成质效评分 0-20分
    comments TEXT,
    evaluation_period VARCHAR(20), -- 评价周期
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, evaluator_id)
);

-- 8. 创建重点工作表
CREATE TABLE key_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    max_score DECIMAL(4,2) DEFAULT 20.00, -- 最高20分
    status VARCHAR(20) DEFAULT 'assigned', -- assigned, in_progress, completed, closed
    priority VARCHAR(20) DEFAULT 'high',
    start_date DATE,
    end_date DATE,
    assigned_by UUID REFERENCES users(id), -- 分配人（考核办管理员/分管领导）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 创建重点工作参与人员表
CREATE TABLE key_work_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL REFERENCES key_works(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- leader(领办), assistant(协办)
    score DECIMAL(4,2) DEFAULT 0, -- 获得积分
    completion_status VARCHAR(20) DEFAULT 'pending', -- pending, completed
    completion_report TEXT, -- 完成报告
    completion_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(key_work_id, user_id)
);

-- 10. 创建绩效奖励积分表
CREATE TABLE performance_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bonus_type VARCHAR(50) NOT NULL, -- award(表彰加分), advanced(先进加分), special(专项奖励)
    score DECIMAL(4,2) NOT NULL,
    title VARCHAR(200) NOT NULL, -- 奖励名称
    description TEXT,
    period VARCHAR(20), -- 奖励周期
    awarded_by VARCHAR(100), -- 颁发单位
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREate INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_roles ON users USING GIN(roles);
CREATE INDEX idx_scores_user_id ON scores(user_id);
CREATE INDEX idx_scores_type ON scores(score_type);
CREATE INDEX idx_scores_period ON scores(period);
CREATE INDEX idx_scores_created_at ON scores(created_at DESC);
CREATE INDEX idx_basic_duty_scores_user_period ON basic_duty_scores(user_id, period);
CREATE INDEX idx_work_tasks_user_id ON work_tasks(user_id);
CREATE INDEX idx_work_tasks_status ON work_tasks(status);
CREATE INDEX idx_performance_evaluations_task ON performance_evaluations(task_id);
CREATE INDEX idx_performance_evaluations_evaluator ON performance_evaluations(evaluator_id);
CREATE INDEX idx_performance_evaluations_evaluated ON performance_evaluations(evaluated_id);
CREATE INDEX idx_key_works_status ON key_works(status);
CREATE INDEX idx_key_work_participants_work ON key_work_participants(key_work_id);
CREATE INDEX idx_key_work_participants_user ON key_work_participants(user_id);
CREATE INDEX idx_performance_bonuses_user ON performance_bonuses(user_id);
CREATE INDEX idx_performance_bonuses_period ON performance_bonuses(period);

-- 初始化部门数据
INSERT INTO departments (name, description) VALUES
('考核办公室', '负责绩效考核工作的统计汇总、督查通报'),
('养护科', '负责公路养护相关工作'),
('工程科', '负责工程建设相关工作'),
('办公室', '负责行政管理相关工作'),
('财务科', '负责财务管理相关工作'),
('安全科', '负责安全生产相关工作');

-- 初始化积分类型数据
INSERT INTO score_types (id, name, category, max_score, min_score, description) VALUES
('attendance', '考勤管理', 'basic_duty', 5, 0, '考核上班迟到、早退、旷工情况'),
('learning', '基础学习', 'basic_duty', 5, 0, '考核参加学习培训情况'),
('discipline', '工作纪律', 'basic_duty', 10, 0, '考核工作作风、纪律执行情况'),
('work_quantity', '工作任务量', 'performance', 30, 0, '考核工作任务完成数量'),
('work_quality', '工作完成质效', 'performance', 20, 0, '考核工作任务完成质量和效率'),
('key_work', '重点工作', 'key_work', 20, 0, '考核重大项目和专项活动参与情况'),
('performance_bonus', '绩效奖励', 'bonus', 999, 0, '表彰加分、先进加分等奖励积分');