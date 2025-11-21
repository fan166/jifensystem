-- 037_cleanup_duplicate_tables.sql
-- 目的：统一关键业务表结构、清理重复DDL、统一RLS策略、补充索引，并提供奖惩过渡视图
-- 注意：全部操作尽量使用 IF EXISTS / IF NOT EXISTS 或条件执行，避免重复与错误；保持数据完整性

-- =============================
-- 1) 统一 final_performance_scores 表结构
-- =============================
ALTER TABLE IF EXISTS public.final_performance_scores
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS period text,
  ADD COLUMN IF NOT EXISTS total_score numeric,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 唯一约束：user_id + period
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'final_performance_scores_user_period_unique'
  ) THEN
    ALTER TABLE public.final_performance_scores
      ADD CONSTRAINT final_performance_scores_user_period_unique UNIQUE (user_id, period);
  END IF;
END $$;

-- 外键：user_id → users(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='final_performance_scores' AND column_name='user_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='final_performance_scores_user_fk'
  ) THEN
    ALTER TABLE public.final_performance_scores
      ADD CONSTRAINT final_performance_scores_user_fk FOREIGN KEY (user_id)
      REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 外键：department_id → departments(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='departments' AND column_name='id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='final_performance_scores' AND column_name='department_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='final_performance_scores_department_fk'
  ) THEN
    ALTER TABLE public.final_performance_scores
      ADD CONSTRAINT final_performance_scores_department_fk FOREIGN KEY (department_id)
      REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_final_scores_user_period ON public.final_performance_scores(user_id, period);
CREATE INDEX IF NOT EXISTS idx_final_scores_department ON public.final_performance_scores(department_id);

-- =============================
-- 2) 统一 work_tasks 表结构
-- =============================
ALTER TABLE IF EXISTS public.work_tasks
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 外键：assigned_to → users(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='work_tasks' AND column_name='assigned_to'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='work_tasks_assigned_to_fk'
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_assigned_to_fk FOREIGN KEY (assigned_to)
      REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 外键：department_id → departments(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='departments' AND column_name='id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='work_tasks' AND column_name='department_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='work_tasks_department_fk'
  ) THEN
    ALTER TABLE public.work_tasks
      ADD CONSTRAINT work_tasks_department_fk FOREIGN KEY (department_id)
      REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_work_tasks_status_dept_due ON public.work_tasks(status, department_id, due_date);
CREATE INDEX IF NOT EXISTS idx_work_tasks_assigned ON public.work_tasks(assigned_to);

-- =============================
-- 3) 统一 key_works 相关表结构
-- =============================
-- key_works
ALTER TABLE IF EXISTS public.key_works
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_key_works_dept_status ON public.key_works(department_id, status);
CREATE INDEX IF NOT EXISTS idx_key_works_owner ON public.key_works(owner_id);

-- key_work_participants
ALTER TABLE IF EXISTS public.key_work_participants
  ADD COLUMN IF NOT EXISTS key_work_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_key_work_participants_kw_user ON public.key_work_participants(key_work_id, user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='key_work_participants' AND column_name='key_work_id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='key_works' AND column_name='id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='key_work_participants_kw_fk'
  ) THEN
    ALTER TABLE public.key_work_participants
      ADD CONSTRAINT key_work_participants_kw_fk FOREIGN KEY (key_work_id)
      REFERENCES public.key_works(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='id'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='key_work_participants' AND column_name='user_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='key_work_participants_user_fk'
  ) THEN
    ALTER TABLE public.key_work_participants
      ADD CONSTRAINT key_work_participants_user_fk FOREIGN KEY (user_id)
      REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- key_work_evaluations
ALTER TABLE IF EXISTS public.key_work_evaluations
  ADD COLUMN IF NOT EXISTS key_work_id uuid,
  ADD COLUMN IF NOT EXISTS evaluator_id uuid,
  ADD COLUMN IF NOT EXISTS score numeric,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_key_work_evaluations_kw ON public.key_work_evaluations(key_work_id);
CREATE INDEX IF NOT EXISTS idx_key_work_evaluations_evaluator ON public.key_work_evaluations(evaluator_id);

-- key_work_milestones
ALTER TABLE IF EXISTS public.key_work_milestones
  ADD COLUMN IF NOT EXISTS key_work_id uuid,
  ADD COLUMN IF NOT EXISTS milestone_date date,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_key_work_milestones_kw ON public.key_work_milestones(key_work_id);
CREATE INDEX IF NOT EXISTS idx_key_work_milestones_date ON public.key_work_milestones(milestone_date);

-- =============================
-- 4) 统一 permission_settings 表结构
-- =============================
ALTER TABLE IF EXISTS public.permission_settings
  ADD COLUMN IF NOT EXISTS id bigserial,
  ADD COLUMN IF NOT EXISTS department_id uuid,
  ADD COLUMN IF NOT EXISTS setting_key text,
  ADD COLUMN IF NOT EXISTS setting_value jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='permission_settings' AND column_name='id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='permission_settings_pkey'
  ) THEN
    ALTER TABLE public.permission_settings ADD PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='permission_settings_dept_key_unique'
  ) THEN
    ALTER TABLE public.permission_settings
      ADD CONSTRAINT permission_settings_dept_key_unique UNIQUE (department_id, setting_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_permission_settings_dept ON public.permission_settings(department_id);
CREATE INDEX IF NOT EXISTS idx_permission_settings_key ON public.permission_settings(setting_key);

-- =============================
-- 5) 统一RLS策略（启用且避免重复创建）
-- =============================
-- final_performance_scores RLS
ALTER TABLE IF EXISTS public.final_performance_scores ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='final_performance_scores' AND policyname='final_scores_select_policy'
  ) THEN
    CREATE POLICY final_scores_select_policy ON public.final_performance_scores
      FOR SELECT USING (
        user_id = auth.uid()
        OR department_id IN (
          SELECT department_id FROM public.users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='final_performance_scores' AND policyname='final_scores_update_policy'
  ) THEN
    CREATE POLICY final_scores_update_policy ON public.final_performance_scores
      FOR UPDATE USING (
        user_id = auth.uid()
      ) WITH CHECK (
        user_id = auth.uid()
      );
  END IF;
END $$;

-- work_tasks RLS
ALTER TABLE IF EXISTS public.work_tasks ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_tasks' AND policyname='work_tasks_select_policy'
  ) THEN
    CREATE POLICY work_tasks_select_policy ON public.work_tasks
      FOR SELECT USING (
        assigned_to = auth.uid()
        OR department_id IN (
          SELECT department_id FROM public.users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_tasks' AND policyname='work_tasks_write_policy'
  ) THEN
    CREATE POLICY work_tasks_write_policy ON public.work_tasks
      FOR ALL USING (
        assigned_to = auth.uid()
        OR department_id IN (
          SELECT department_id FROM public.users WHERE id = auth.uid()
        )
      ) WITH CHECK (
        assigned_to = auth.uid()
        OR department_id IN (
          SELECT department_id FROM public.users WHERE id = auth.uid()
        )
      );
  END IF;
END $$;

-- key_works RLS（按部门、所有者或参与者可见）
ALTER TABLE IF EXISTS public.key_works ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='key_works' AND policyname='key_works_select_policy'
  ) THEN
    CREATE POLICY key_works_select_policy ON public.key_works
      FOR SELECT USING (
        owner_id = auth.uid()
        OR department_id IN (SELECT department_id FROM public.users WHERE id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.key_work_participants kwp
          WHERE kwp.key_work_id = key_works.id AND kwp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- permission_settings RLS（按部门可见/修改）
ALTER TABLE IF EXISTS public.permission_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_settings' AND policyname='permission_settings_select_policy'
  ) THEN
    CREATE POLICY permission_settings_select_policy ON public.permission_settings
      FOR SELECT USING (
        department_id IN (SELECT department_id FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='permission_settings' AND policyname='permission_settings_update_policy'
  ) THEN
    CREATE POLICY permission_settings_update_policy ON public.permission_settings
      FOR UPDATE USING (
        department_id IN (SELECT department_id FROM public.users WHERE id = auth.uid())
      ) WITH CHECK (
        department_id IN (SELECT department_id FROM public.users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- =============================
-- 6) 奖惩数据迁移视图（安全镜像旧表，后续用于数据迁移）
-- =============================
DO $$
DECLARE
  cols text := 'r.id AS reward_id, r.user_id';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='rewards'
  ) THEN
    -- 动态拼接列，避免不存在列导致错误
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rewards' AND column_name='department_id'
    ) THEN
      cols := cols || ', r.department_id';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rewards' AND column_name='created_at'
    ) THEN
      cols := cols || ', r.created_at';
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rewards' AND column_name='updated_at'
    ) THEN
      cols := cols || ', r.updated_at';
    END IF;
    EXECUTE format('CREATE OR REPLACE VIEW public.v_rewards_mapped AS SELECT %s FROM public.rewards r', cols);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='v_rewards_mapped'
  ) THEN
    EXECUTE 'COMMENT ON VIEW public.v_rewards_mapped IS ''迁移过渡视图：镜像旧 rewards 表以便后续映射到 reward_types + reward_score_records''';
  END IF;
END $$;

-- =============================
-- 7) 其他通用索引补充（如存在）
-- =============================
CREATE INDEX IF NOT EXISTS idx_key_work_participants_user ON public.key_work_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_key_work_evaluations_score ON public.key_work_evaluations(score);

-- 迁移结束