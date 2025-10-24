-- 修改users表的email字段，允许为null
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 添加注释说明
COMMENT ON COLUMN users.email IS '用户邮箱，可选字段';