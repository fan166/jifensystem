-- 038_remove_unused_duplicate_tables.sql
-- 目的：根据前端实际使用情况，备份并移除重复/未使用的库表，保持结构简洁
-- 依据：前端检索到的 .from() 使用情况未引用以下库表：
-- 1) final_work_performance_scores（与 final_performance_scores 重复）
-- 2) evaluation_visibility_settings（已由 permission_settings 统一管理）
-- 3) system_roles / system_role_permissions / user_system_roles（与 permissions/role_permissions/user_permissions 概念重复，前端未用）
--
-- 迁移策略：
-- - 对每个待删除表先进行数据备份（CREATE TABLE backup_* AS SELECT * FROM ...）
-- - 使用条件判断与 IF EXISTS，避免目标不存在时报错
-- - 使用 CASCADE 安全删除相关依赖

BEGIN;

-- 统一：移除与 final_performance_scores 重复的旧表
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'final_work_performance_scores'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_final_work_performance_scores AS SELECT * FROM public.final_work_performance_scores';
    EXECUTE 'DROP TABLE IF EXISTS public.final_work_performance_scores CASCADE';
  END IF;
END $$;

-- 统一：权限可见性设置已由 permission_settings 管理
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'evaluation_visibility_settings'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_evaluation_visibility_settings AS SELECT * FROM public.evaluation_visibility_settings';
    EXECUTE 'DROP TABLE IF EXISTS public.evaluation_visibility_settings CASCADE';
  END IF;
END $$;

-- 清理重复的系统角色表（保留 permissions/role_permissions/user_permissions 套件）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'system_roles'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_system_roles AS SELECT * FROM public.system_roles';
    EXECUTE 'DROP TABLE IF EXISTS public.system_roles CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'system_role_permissions'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_system_role_permissions AS SELECT * FROM public.system_role_permissions';
    EXECUTE 'DROP TABLE IF EXISTS public.system_role_permissions CASCADE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_system_roles'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS backup_user_system_roles AS SELECT * FROM public.user_system_roles';
    EXECUTE 'DROP TABLE IF EXISTS public.user_system_roles CASCADE';
  END IF;
END $$;

COMMIT;

-- 注意：如需恢复，可将 backup_* 表数据重新导入原结构或作为参考视图保留。