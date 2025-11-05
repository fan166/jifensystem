-- 文件名: 036_set_permission_defaults.sql
-- 目的: 将“普通员工-日常实绩评价可见性”和“普通员工-年终集体测评可见性”默认设置为关闭，
--       并在现有环境中批量更新为关闭状态。

BEGIN;

-- 确保这两条设置存在，若不存在则以默认关闭插入；若存在则更新为关闭
INSERT INTO permission_settings (setting_key, is_enabled, description)
VALUES 
  ('daily_evaluation_visible', false, '普通用户日常实绩评价界面可见性'),
  ('annual_evaluation_visible', false, '普通用户年终集体测评界面可见性')
ON CONFLICT (setting_key)
DO UPDATE SET 
  is_enabled = EXCLUDED.is_enabled,
  updated_at = NOW();

COMMIT;