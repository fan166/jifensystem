-- 修复 monthly_reward_summary 权限问题
-- 确保 anon 和 authenticated 角色有适当权限

-- 检查当前权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'monthly_reward_summary'
  AND grantee IN ('anon', 'authenticated');

-- 如果权限不足，重新授权
GRANT SELECT ON monthly_reward_summary TO anon;
GRANT ALL PRIVILEGES ON monthly_reward_summary TO authenticated;

-- 检查并修复 RLS 策略
-- 先删除现有策略再创建（避免重复）
DROP POLICY IF EXISTS "monthly_reward_summary_own" ON monthly_reward_summary;
DROP POLICY IF EXISTS "monthly_reward_summary_admin" ON monthly_reward_summary;

-- 确保用户能查看自己的数据
CREATE POLICY "monthly_reward_summary_own" ON monthly_reward_summary
    FOR SELECT USING (user_id = auth.uid());

-- 确保管理员能查看所有数据
CREATE POLICY "monthly_reward_summary_admin" ON monthly_reward_summary
    FOR ALL USING (auth.uid() IN (
        SELECT id FROM users WHERE role IN ('system_admin', 'assessment_admin', 'leader')
    ));

-- 检查用户角色权限
SELECT 
    u.id,
    u.name,
    u.role,
    CASE 
        WHEN u.role IN ('system_admin', 'assessment_admin', 'leader') THEN '管理员'
        ELSE '普通用户'
    END as role_type
FROM users u
WHERE u.id = auth.uid();