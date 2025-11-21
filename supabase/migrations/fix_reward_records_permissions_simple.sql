-- 修复奖励记录表权限 - 简化版本
-- 直接授予权限，不依赖RLS策略

-- 授予基本权限
GRANT SELECT ON reward_score_records TO anon;
GRANT SELECT ON reward_score_records TO authenticated;
GRANT ALL ON reward_score_records TO authenticated;

-- 授予相关表的访问权限
GRANT SELECT ON reward_types TO anon;
GRANT SELECT ON reward_types TO authenticated;

GRANT SELECT ON users TO anon;
GRANT SELECT ON users TO authenticated;

GRANT SELECT ON departments TO anon;
GRANT SELECT ON departments TO authenticated;

-- 禁用RLS（如果启用导致权限问题）
ALTER TABLE reward_score_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE reward_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- 检查权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'reward_score_records' 
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;