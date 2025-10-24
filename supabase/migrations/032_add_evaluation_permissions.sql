-- 文件名: 032_add_evaluation_permissions.sql
-- 添加评价表相关的权限设置

-- 插入日常实绩评价查看权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'view_daily_evaluation',
  true,
  '["employee", "assessment_admin", "system_admin"]'::jsonb,
  '查看日常实绩评价表的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();

-- 插入年终集体测评查看权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'view_annual_evaluation',
  true,
  '["employee", "assessment_admin", "system_admin"]'::jsonb,
  '查看年终集体测评表的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();

-- 插入日常实绩评价创建权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'create_daily_evaluation',
  true,
  '["employee", "assessment_admin", "system_admin"]'::jsonb,
  '创建日常实绩评价的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();

-- 插入年终集体测评创建权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'create_annual_evaluation',
  true,
  '["employee", "assessment_admin", "system_admin"]'::jsonb,
  '创建年终集体测评的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();

-- 插入评价编辑权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'edit_evaluation',
  true,
  '["assessment_admin", "system_admin"]'::jsonb,
  '编辑评价记录的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();

-- 插入评价审批权限
INSERT INTO permission_settings (setting_key, is_enabled, target_roles, description)
VALUES (
  'approve_evaluation',
  true,
  '["assessment_admin", "system_admin"]'::jsonb,
  '审批评价记录的权限'
) ON CONFLICT (setting_key) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  target_roles = EXCLUDED.target_roles,
  description = EXCLUDED.description,
  updated_at = now();