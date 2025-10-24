-- 检查积分模块表的权限设置
-- 查询anon和authenticated角色对积分模块表的权限

SELECT 
    grantee,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
    AND grantee IN ('anon', 'authenticated')
    AND table_name IN (
        'basic_duty_scores',
        'basic_duty_score_history', 
        'basic_duty_import_batches',
        'work_tasks',
        'work_task_evaluations',
        'monthly_performance_summary',
        'key_works',
        'key_work_participants',
        'key_work_evaluations', 
        'key_work_milestones',
        'reward_types',
        'reward_applications',
        'reward_approval_flows',
        'reward_score_records',
        'monthly_reward_summary'
    )
ORDER BY table_name, grantee;

-- 检查RLS策略状态
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
    AND tablename IN (
        'basic_duty_scores',
        'basic_duty_score_history', 
        'basic_duty_import_batches',
        'work_tasks',
        'work_task_evaluations',
        'monthly_performance_summary',
        'key_works',
        'key_work_participants',
        'key_work_evaluations', 
        'key_work_milestones',
        'reward_types',
        'reward_applications',
        'reward_approval_flows',
        'reward_score_records',
        'monthly_reward_summary'
    )
ORDER BY tablename;