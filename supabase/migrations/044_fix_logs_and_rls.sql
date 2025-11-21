-- 文件名: 044_fix_logs_and_rls.sql
-- 目的: 修复公告与操作日志的RLS策略角色不一致问题，并移除操作日志的外键约束以避免插入失败

BEGIN;

-- 1) 修复 announcements 写策略角色检查（system_admin/assessment_admin -> admin/manager）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='announcements' AND policyname='announcements_write_admin_policy'
  ) THEN
    DROP POLICY announcements_write_admin_policy ON public.announcements;
  END IF;

  CREATE POLICY announcements_write_admin_policy ON public.announcements
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('admin','manager')
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('admin','manager')
      )
    );
END $$;

-- 2) 修复 operation_logs 策略角色检查，并允许 user_id 为 NULL 的插入
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_select_policy'
  ) THEN
    DROP POLICY operation_logs_select_policy ON public.operation_logs;
  END IF;

  CREATE POLICY operation_logs_select_policy ON public.operation_logs
    FOR SELECT USING (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')
      )
    );

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_insert_policy'
  ) THEN
    DROP POLICY operation_logs_insert_policy ON public.operation_logs;
  END IF;

  CREATE POLICY operation_logs_insert_policy ON public.operation_logs
    FOR INSERT WITH CHECK (
      user_id = auth.uid() OR user_id IS NULL
    );

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_admin_write_policy'
  ) THEN
    DROP POLICY operation_logs_admin_write_policy ON public.operation_logs;
  END IF;

  CREATE POLICY operation_logs_admin_write_policy ON public.operation_logs
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','manager')
      )
    );
END $$;

-- 3) 删除操作日志的用户外键约束，避免用户表不存在对应ID时写入失败
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='operation_logs_user_fk'
  ) THEN
    ALTER TABLE public.operation_logs DROP CONSTRAINT operation_logs_user_fk;
  END IF;
END $$;

COMMIT;