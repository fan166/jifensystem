-- 检查departments表的权限设置并修复

-- 检查当前权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'departments'
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;

-- 为anon角色授予SELECT权限（用于读取部门列表）
GRANT SELECT ON departments TO anon;

-- 为authenticated角色授予完整权限（用于CRUD操作）
GRANT ALL PRIVILEGES ON departments TO authenticated;

-- 创建RLS策略允许所有用户读取部门信息
CREATE POLICY "Allow read access to departments" ON departments
    FOR SELECT USING (true);

-- 创建RLS策略允许认证用户进行所有操作
CREATE POLICY "Allow authenticated users full access to departments" ON departments
    FOR ALL USING (auth.role() = 'authenticated');

-- 再次检查权限是否设置成功
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
AND table_name = 'departments'
AND grantee IN ('anon', 'authenticated') 
ORDER BY table_name, grantee;