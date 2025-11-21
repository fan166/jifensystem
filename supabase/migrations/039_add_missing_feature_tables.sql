-- 039_add_missing_feature_tables.sql
-- 目的：为前端功能补齐缺失的表（announcements、operation_logs、key_work_progress），并配置必要索引与RLS策略

-- 扩展：确保可用 UUID 生成函数
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================
-- 1) 公告 announcements
-- =====================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'info', -- 'info' | 'success' | 'warning' | 'error'
  priority text DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  is_read boolean DEFAULT false,
  starts_at timestamptz NULL,
  ends_at timestamptz NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NULL
);

-- 外键约束：created_by → users(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='announcements_created_by_fk'
  ) THEN
    ALTER TABLE public.announcements
      ADD CONSTRAINT announcements_created_by_fk FOREIGN KEY (created_by)
      REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_is_read ON public.announcements(is_read);
CREATE INDEX IF NOT EXISTS idx_announcements_validity ON public.announcements(starts_at, ends_at);

-- 启用RLS
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;

-- 仅认证用户可读取公告
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND policyname='announcements_select_policy'
  ) THEN
    CREATE POLICY announcements_select_policy ON public.announcements
      FOR SELECT USING (
        auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- 仅管理员可写（创建/更新/删除）公告
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND policyname='announcements_write_admin_policy'
  ) THEN
    CREATE POLICY announcements_write_admin_policy ON public.announcements
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role IN ('system_admin','assessment_admin')
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid() AND u.role IN ('system_admin','assessment_admin')
        )
      );
  END IF;
END $$;

-- =====================================
-- 2) 操作日志 operation_logs
-- =====================================
CREATE TABLE IF NOT EXISTS public.operation_logs (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  details jsonb NOT NULL,
  user_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

-- 外键约束：user_id → users(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='operation_logs_user_fk'
  ) THEN
    ALTER TABLE public.operation_logs
      ADD CONSTRAINT operation_logs_user_fk FOREIGN KEY (user_id)
      REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON public.operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON public.operation_logs(user_id);

-- 启用RLS
ALTER TABLE IF EXISTS public.operation_logs ENABLE ROW LEVEL SECURITY;

-- 读取：本人或管理员可见
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_select_policy'
  ) THEN
    CREATE POLICY operation_logs_select_policy ON public.operation_logs
      FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('system_admin','assessment_admin')
        )
      );
  END IF;
END $$;

-- 写入：允许认证用户写入自己的日志（recordOperation）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_insert_policy'
  ) THEN
    CREATE POLICY operation_logs_insert_policy ON public.operation_logs
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
      );
  END IF;
END $$;

-- 更新/删除：仅管理员
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_admin_write_policy'
  ) THEN
    CREATE POLICY operation_logs_admin_write_policy ON public.operation_logs
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('system_admin','assessment_admin')
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('system_admin','assessment_admin')
        )
      );
  END IF;
END $$;

-- =====================================
-- 3) 关键工作进度 key_work_progress
-- =====================================
CREATE TABLE IF NOT EXISTS public.key_work_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_work_id uuid NOT NULL,
  progress_description text NOT NULL,
  completion_percentage int NOT NULL CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  attachments text[] NULL,
  reported_by uuid NOT NULL,
  reported_at timestamptz DEFAULT now()
);

-- 外键约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='key_work_progress_kw_fk'
  ) THEN
    ALTER TABLE public.key_work_progress
      ADD CONSTRAINT key_work_progress_kw_fk FOREIGN KEY (key_work_id)
      REFERENCES public.key_works(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='key_work_progress_reported_by_fk'
  ) THEN
    ALTER TABLE public.key_work_progress
      ADD CONSTRAINT key_work_progress_reported_by_fk FOREIGN KEY (reported_by)
      REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 索引
CREATE INDEX IF NOT EXISTS idx_key_work_progress_kw_reported_at ON public.key_work_progress(key_work_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_key_work_progress_reporter ON public.key_work_progress(reported_by);

-- 启用RLS
ALTER TABLE IF EXISTS public.key_work_progress ENABLE ROW LEVEL SECURITY;

-- 读取：报告人、关键工作所有者/同部门成员、参与者均可读
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='key_work_progress' AND policyname='key_work_progress_select_policy'
  ) THEN
    CREATE POLICY key_work_progress_select_policy ON public.key_work_progress
      FOR SELECT USING (
        reported_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.key_works kw
          WHERE kw.id = key_work_progress.key_work_id
            AND (
              kw.owner_id = auth.uid()
              OR kw.department_id IN (SELECT department_id FROM public.users WHERE id = auth.uid())
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.key_work_participants kwp
          WHERE kwp.key_work_id = key_work_progress.key_work_id AND kwp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 写入：报告人或关键工作所有者可写
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='key_work_progress' AND policyname='key_work_progress_write_policy'
  ) THEN
    CREATE POLICY key_work_progress_write_policy ON public.key_work_progress
      FOR ALL USING (
        reported_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.key_works kw WHERE kw.id = key_work_progress.key_work_id AND kw.owner_id = auth.uid()
        )
      ) WITH CHECK (
        reported_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.key_works kw WHERE kw.id = key_work_progress.key_work_id AND kw.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 迁移结束