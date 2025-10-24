-- 修复users表权限问题
-- 确保anon和authenticated角色可以访问users表

-- 授予anon角色对users表的SELECT权限（用于读取用户列表）
GRANT SELECT ON users TO anon;

-- 授予authenticated角色对users表的完整权限
GRANT ALL PRIVILEGES ON users TO authenticated;

-- 授予anon角色对departments表的SELECT权限
GRANT SELECT ON departments TO anon;

-- 授予authenticated角色对departments表的完整权限
GRANT ALL PRIVILEGES ON departments TO authenticated;

-- 确保序列权限正确设置
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 创建或更新users表的RLS策略（如果需要的话）
-- 注意：当前RLS已禁用，但为了安全考虑，可以启用简单的策略

-- 如果要启用RLS，可以取消注释以下代码：
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- 
-- -- 允许所有用户读取用户信息
-- CREATE POLICY "Allow read access to users" ON users
--   FOR SELECT TO anon, authenticated
--   USING (true);
-- 
-- -- 允许认证用户创建和更新用户
-- CREATE POLICY "Allow authenticated users to manage users" ON users
--   FOR ALL TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- 确保函数权限正确
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;