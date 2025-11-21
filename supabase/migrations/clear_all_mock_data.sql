-- 清空所有模拟数据脚本
-- 目的：清除项目中的所有测试、演示和模拟数据
-- 执行顺序：从子表到主表，避免外键约束错误

BEGIN;

-- 1. 清空所有业务数据表（按依赖顺序）

-- 清空绩效相关子表
DELETE FROM public.daily_performance_summary;
DELETE FROM public.monthly_performance_summary;
DELETE FROM public.final_performance_scores;
DELETE FROM public.work_task_evaluations;
DELETE FROM public.work_tasks;
DELETE FROM public.key_work_evaluations;
DELETE FROM public.key_work_progress;
DELETE FROM public.key_work_participants;
DELETE FROM public.key_works;
DELETE FROM public.basic_duty_scores;
DELETE FROM public.performance_evaluations;
DELETE FROM public.performance_bonuses;
DELETE FROM public.monthly_reward_summary;
DELETE FROM public.reward_score_records;

-- 清空公告数据
DELETE FROM public.announcements;

-- 2. 清空用户数据（保留系统必需的管理员账户）
-- 删除所有非管理员用户和演示用户
DELETE FROM public.users 
WHERE email IN (
  'admin@company.com',
  'manager@company.com', 
  'employee@company.com',
  'test@example.com',
  'test2@example.com',
  'admin@example.com',
  'manager@example.com',
  'leader@example.com',
  'dept_head@example.com',
  'employee@example.com',
  'employee2@example.com',
  'employee3@example.com',
  'employee4@example.com'
) 
OR email LIKE 'employee\_\_\_%@example.com'
OR email LIKE 'employee_%@example.com'
OR email LIKE 'system_admin_%@example.com'
OR email LIKE 'assessment_admin_%@example.com'
OR email LIKE 'employee_%@example.com';

-- 3. 清空部门数据（保留必需的核心部门）
DELETE FROM public.departments 
WHERE name IN (
  '综合部', '财务部', '人事部', '信息化中心', '后勤保障', '项目管理办公室'
);

-- 4. 重置序列计数器
ALTER SEQUENCE public.users_id_seq RESTART WITH 1;
ALTER SEQUENCE public.departments_id_seq RESTART WITH 1;
ALTER SEQUENCE public.work_tasks_id_seq RESTART WITH 1;
ALTER SEQUENCE public.key_works_id_seq RESTART WITH 1;
ALTER SEQUENCE public.announcements_id_seq RESTART WITH 1;
ALTER SEQUENCE public.reward_score_records_id_seq RESTART WITH 1;

-- 5. 验证清空结果
SELECT 
  'users' as table_name, 
  COUNT(*) as record_count 
FROM public.users
UNION ALL
SELECT 
  'departments' as table_name, 
  COUNT(*) as record_count 
FROM public.departments
UNION ALL
SELECT 
  'work_tasks' as table_name, 
  COUNT(*) as record_count 
FROM public.work_tasks
UNION ALL
SELECT 
  'key_works' as table_name, 
  COUNT(*) as record_count 
FROM public.key_works
UNION ALL
SELECT 
  'reward_score_records' as table_name, 
  COUNT(*) as record_count 
FROM public.reward_score_records
UNION ALL
SELECT 
  'performance_evaluations' as table_name, 
  COUNT(*) as record_count 
FROM public.performance_evaluations
UNION ALL
SELECT 
  'announcements' as table_name, 
  COUNT(*) as record_count 
FROM public.announcements;

COMMIT;