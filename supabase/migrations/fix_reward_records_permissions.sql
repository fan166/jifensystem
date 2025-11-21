-- 修复奖励记录表权限
-- 授予匿名用户和认证用户访问reward_score_records表的权限

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

-- 如果RLS启用，创建允许访问的策略
DO $$
BEGIN
  -- 检查reward_score_records是否存在RLS策略
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reward_score_records') THEN
    -- 删除现有策略（如果存在）
    DROP POLICY IF EXISTS "允许匿名用户查看奖励记录" ON reward_score_records;
    DROP POLICY IF EXISTS "允许认证用户查看奖励记录" ON reward_score_records;
    DROP POLICY IF EXISTS "允许认证用户创建奖励记录" ON reward_score_records;
    DROP POLICY IF EXISTS "允许认证用户更新奖励记录" ON reward_score_records;
    DROP POLICY IF EXISTS "允许认证用户删除奖励记录" ON reward_score_records;
    
    -- 创建新的RLS策略
    CREATE POLICY "允许匿名用户查看奖励记录" ON reward_score_records
      FOR SELECT
      TO anon
      USING (is_public = true);
    
    CREATE POLICY "允许认证用户查看奖励记录" ON reward_score_records
      FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "允许认证用户创建奖励记录" ON reward_score_records
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
    
    CREATE POLICY "允许认证用户更新奖励记录" ON reward_score_records
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
    
    CREATE POLICY "允许认证用户删除奖励记录" ON reward_score_records
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END
$$;

-- 检查权限
SELECT grantee, table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name = 'reward_score_records' 
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;