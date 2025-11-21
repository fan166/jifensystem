-- 修复缺失的核心表与外键，统一字段命名以匹配前端
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 统一更新时间触发函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 departments 表补充 is_active 字段
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
COMMENT ON COLUMN public.departments.is_active IS '部门是否活跃状态';

-- 为 users.department_id 添加外键，支持嵌套查询 users -> departments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema='public' AND table_name='users' AND constraint_name='users_department_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 创建积分类型表（与前端类型一致）
CREATE TABLE IF NOT EXISTS public.score_types (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('basic_duty','work_performance','key_work','performance_bonus')),
    max_score DECIMAL(5,2),
    min_score DECIMAL(5,2) DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化/更新积分类型
INSERT INTO public.score_types (id, name, category, max_score, min_score, description)
VALUES
    ('attendance', '考勤管理', 'basic_duty', 5, 0, '考核上班迟到、早退、旷工情况'),
    ('learning', '基础学习', 'basic_duty', 5, 0, '考核参加学习培训情况'),
    ('discipline', '工作纪律', 'basic_duty', 10, 0, '考核工作作风、纪律执行情况'),
    ('work_quantity', '工作任务量', 'work_performance', 30, 0, '考核工作任务完成数量'),
    ('work_quality', '工作完成质效', 'work_performance', 20, 0, '考核工作任务完成质量和效率'),
    ('key_work', '重点工作', 'key_work', 20, 0, '考核重大项目和专项活动参与情况'),
    ('performance_bonus', '绩效奖励', 'performance_bonus', 999, 0, '表彰加分、先进加分等奖励积分')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    max_score = EXCLUDED.max_score,
    min_score = EXCLUDED.min_score,
    description = EXCLUDED.description;

-- 创建积分记录表（与前端 services 对齐）
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    score_type_id VARCHAR(50) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    reason TEXT,
    period VARCHAR(7),
    recorder_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为 scores 添加外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='scores' AND constraint_name='scores_user_id_fkey'
  ) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='scores' AND constraint_name='scores_recorder_id_fkey'
  ) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_recorder_id_fkey FOREIGN KEY (recorder_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='scores' AND constraint_name='scores_score_type_id_fkey'
  ) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_score_type_id_fkey FOREIGN KEY (score_type_id) REFERENCES public.score_types(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON public.scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_type ON public.scores(score_type_id);
CREATE INDEX IF NOT EXISTS idx_scores_period ON public.scores(period);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON public.scores(created_at DESC);

-- 创建工作实绩评价表（与前端 DailyEvaluationTab 对齐）
CREATE TABLE IF NOT EXISTS public.performance_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluated_user_id UUID NOT NULL,
    evaluator_id UUID NOT NULL,
    period VARCHAR(7) NOT NULL,
    evaluation_type VARCHAR(10) NOT NULL CHECK (evaluation_type IN ('daily','annual')),
    work_volume_score NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (work_volume_score >= 0 AND work_volume_score <= 30),
    work_quality_score NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (work_quality_score >= 0 AND work_quality_score <= 20),
    key_work_score NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (key_work_score >= 0 AND key_work_score <= 20),
    total_score NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 70),
    comments TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
    batch_id UUID,
    is_anonymous BOOLEAN DEFAULT false,
    evaluation_round INTEGER DEFAULT 1,
    weight_factor DECIMAL(3,2) DEFAULT 1.00 CHECK (weight_factor >= 0 AND weight_factor <= 1),
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    evaluation_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 外键
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='performance_evaluations' AND constraint_name='performance_evaluations_evaluated_user_id_fkey'
  ) THEN
    ALTER TABLE public.performance_evaluations ADD CONSTRAINT performance_evaluations_evaluated_user_id_fkey FOREIGN KEY (evaluated_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='performance_evaluations' AND constraint_name='performance_evaluations_evaluator_id_fkey'
  ) THEN
    ALTER TABLE public.performance_evaluations ADD CONSTRAINT performance_evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES public.users(id);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='evaluation_batches'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='performance_evaluations' AND constraint_name='performance_evaluations_batch_id_fkey'
  ) THEN
    ALTER TABLE public.performance_evaluations ADD CONSTRAINT performance_evaluations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.evaluation_batches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='performance_evaluations' AND constraint_name='performance_evaluations_reviewer_id_fkey'
  ) THEN
    ALTER TABLE public.performance_evaluations ADD CONSTRAINT performance_evaluations_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluated_user ON public.performance_evaluations(evaluated_user_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluator ON public.performance_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_period_type ON public.performance_evaluations(period, evaluation_type);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_status ON public.performance_evaluations(status);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_batch ON public.performance_evaluations(batch_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_anonymous ON public.performance_evaluations(is_anonymous);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_round ON public.performance_evaluations(evaluation_round);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_reviewer ON public.performance_evaluations(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluation_date ON public.performance_evaluations(evaluation_date);

-- 创建重点工作相关表（与 KeyWorkManagement 对齐）
CREATE TABLE IF NOT EXISTS public.key_works (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_title VARCHAR(200) NOT NULL,
    work_description TEXT,
    work_type VARCHAR(50) NOT NULL CHECK (work_type IN ('major_project','special_activity','difficult_task','innovation_project','emergency_response')),
    priority VARCHAR(20) DEFAULT 'high' CHECK (priority IN ('medium','high','urgent')),
    total_score DECIMAL(5,2) DEFAULT 0 CHECK (total_score >= 0 AND total_score <= 20),
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning','in_progress','completed','cancelled','on_hold')),
    start_date DATE,
    end_date DATE,
    actual_completion_date DATE,
    created_by UUID NOT NULL,
    department_id UUID,
    is_cross_department BOOLEAN DEFAULT false,
    completion_rate DECIMAL(5,2) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
    quality_rating VARCHAR(20) CHECK (quality_rating IN ('excellent','good','average','poor')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='key_works' AND constraint_name='key_works_created_by_fkey'
  ) THEN
    ALTER TABLE public.key_works ADD CONSTRAINT key_works_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='key_works' AND constraint_name='key_works_department_id_fkey'
  ) THEN
    ALTER TABLE public.key_works ADD CONSTRAINT key_works_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_key_works_type ON public.key_works(work_type);
CREATE INDEX IF NOT EXISTS idx_key_works_status ON public.key_works(status);
CREATE INDEX IF NOT EXISTS idx_key_works_department ON public.key_works(department_id);
CREATE INDEX IF NOT EXISTS idx_key_works_created_by ON public.key_works(created_by);
CREATE INDEX IF NOT EXISTS idx_key_works_dates ON public.key_works(start_date, end_date);

CREATE TABLE IF NOT EXISTS public.key_work_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_work_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('leader','main_participant','participant','supporter','coordinator')),
    contribution_description TEXT,
    individual_score DECIMAL(4,2) DEFAULT 0 CHECK (individual_score >= 0 AND individual_score <= 20),
    performance_rating VARCHAR(20) CHECK (performance_rating IN ('outstanding','excellent','good','average','poor')),
    assigned_date DATE DEFAULT CURRENT_DATE,
    completion_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(key_work_id, user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='key_work_participants' AND constraint_name='key_work_participants_work_id_fkey'
  ) THEN
    ALTER TABLE public.key_work_participants ADD CONSTRAINT key_work_participants_work_id_fkey FOREIGN KEY (key_work_id) REFERENCES public.key_works(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='key_work_participants' AND constraint_name='key_work_participants_user_id_fkey'
  ) THEN
    ALTER TABLE public.key_work_participants ADD CONSTRAINT key_work_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_key_work_participants_work_id ON public.key_work_participants(key_work_id);
CREATE INDEX IF NOT EXISTS idx_key_work_participants_user_id ON public.key_work_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_key_work_participants_role ON public.key_work_participants(role);
CREATE INDEX IF NOT EXISTS idx_key_work_participants_active ON public.key_work_participants(is_active);

-- 更新触发器（去掉 IF NOT EXISTS 以兼容）
DROP TRIGGER IF EXISTS update_key_works_updated_at ON public.key_works;
CREATE TRIGGER update_key_works_updated_at BEFORE UPDATE ON public.key_works
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_key_work_participants_updated_at ON public.key_work_participants;
CREATE TRIGGER update_key_work_participants_updated_at BEFORE UPDATE ON public.key_work_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 基本授权（读取）
GRANT SELECT ON public.score_types TO anon, authenticated;
GRANT SELECT ON public.scores TO authenticated;
GRANT SELECT ON public.key_works TO anon, authenticated;
GRANT SELECT ON public.key_work_participants TO anon, authenticated;
GRANT SELECT ON public.performance_evaluations TO authenticated;