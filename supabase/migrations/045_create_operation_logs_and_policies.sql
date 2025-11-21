-- 文件名: 045_create_operation_logs_and_policies.sql
-- 目的: 创建操作日志表 operation_logs，配置索引与RLS策略，统一角色标识（admin/manager）

BEGIN;

-- 创建表（若不存在）
CREATE TABLE IF NOT EXISTS public.operation_logs (
  id bigserial PRIMARY KEY,
  action text NOT NULL,
  details jsonb NOT NULL,
  user_id uuid NULL,
  created_at timestamptz DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON public.operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON public.operation_logs(user_id);

-- 启用RLS
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

-- 读取策略：本人或管理员/经理可见
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
END $$;

-- 插入策略：允许本人或匿名（user_id 为空，用于系统事件）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='operation_logs' AND policyname='operation_logs_insert_policy'
  ) THEN
    DROP POLICY operation_logs_insert_policy ON public.operation_logs;
  END IF;

  CREATE POLICY operation_logs_insert_policy ON public.operation_logs
    FOR INSERT WITH CHECK (
      user_id = auth.uid() OR user_id IS NULL
    );
END $$;

-- 更新/删除策略：仅管理员或经理
DO $$
BEGIN
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

-- 权限：允许匿名/认证读取（由RLS实际限制可见范围），允许认证插入
GRANT SELECT ON TABLE public.operation_logs TO anon, authenticated;
GRANT INSERT ON TABLE public.operation_logs TO authenticated;

COMMIT;