-- 文件名: 043_add_created_updated_to_users.sql
-- 目的: 为 users 表补充 created_at / updated_at 字段，并添加更新时间触发器与必要权限

BEGIN;

-- 如果不存在则添加 created_at / updated_at 字段
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 创建通用的更新时间函数（若尚未存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器：更新时自动刷新 updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    -- 若触发器已存在则先删除，避免重复
    DROP TRIGGER update_users_updated_at ON users;
  END IF;
END $$;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 权限：允许匿名与认证角色读取 users 表（前端展示需要）
GRANT SELECT ON TABLE users TO anon, authenticated;

COMMIT;