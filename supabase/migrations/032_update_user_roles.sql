-- 文件名: 032_update_user_roles.sql
-- 更新用户角色约束，统一前后端角色命名

-- 删除现有的role字段约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 先更新现有的admin角色为system_admin
UPDATE users SET role = 'system_admin' WHERE role = 'admin';

-- 更新现有的manager角色为assessment_admin
UPDATE users SET role = 'assessment_admin' WHERE role = 'manager';

-- 添加新的role字段约束，支持system_admin和assessment_admin
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role::text = ANY (ARRAY['system_admin'::character varying, 'assessment_admin'::character varying, 'leader'::character varying, 'employee'::character varying]::text[]));

-- 更新role字段的默认值
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';

-- 验证更新结果
SELECT 'Role update completed. Current roles:' as message;
SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role;