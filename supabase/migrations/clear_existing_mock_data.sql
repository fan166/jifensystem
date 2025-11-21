-- 清空现有数据库中的模拟数据
-- 此脚本只清理实际存在的表

-- 由于外键约束，按依赖关系顺序清理数据

-- 1. 清理奖励相关记录（依赖用户和部门）
DELETE FROM public.奖励积分记录 WHERE true;
DELETE FROM public.reward_score_records WHERE true;

-- 2. 清理绩效相关记录（依赖用户和部门）  
DELETE FROM public.绩效评测 WHERE true;
DELETE FROM public.performance_evaluations WHERE true;
DELETE FROM public.最终表现积分 WHERE true;
DELETE FROM public.final_performance_scores WHERE true;

-- 3. 清理积分记录（依赖用户）
DELETE FROM public.积分记录 WHERE true;
DELETE FROM public.score_records WHERE true;

-- 4. 清理用户相关记录
DELETE FROM public.用户 WHERE true;
DELETE FROM public.users WHERE true;

-- 5. 清理部门相关记录
DELETE FROM public.部门管理 WHERE true;
DELETE FROM public.departments WHERE true;

-- 6. 清理奖励类型配置数据
DELETE FROM public.奖励类型 WHERE true;
DELETE FROM public.reward_types WHERE true;

-- 7. 清理备份表数据
DELETE FROM public.备份用户记录 WHERE true;
DELETE FROM public.备份部门记录 WHERE true;
DELETE FROM public.备份绩效记录 WHERE true;
DELETE FROM public.备份积分记录 WHERE true;
DELETE FROM public.备份奖励记录 WHERE true;

-- 8. 清理其他配置表
DELETE FROM public.系统配置 WHERE true;
DELETE FROM public.system_settings WHERE true;

-- 重置所有表的自增序列
ALTER SEQUENCE public.用户_id_seq RESTART WITH 1;
ALTER SEQUENCE public.users_id_seq RESTART WITH 1;
ALTER SEQUENCE public.部门管理_id_seq RESTART WITH 1;
ALTER SEQUENCE public.departments_id_seq RESTART WITH 1;
ALTER SEQUENCE public.奖励积分记录_id_seq RESTART WITH 1;
ALTER SEQUENCE public.reward_score_records_id_seq RESTART WITH 1;
ALTER SEQUENCE public.绩效评测_id_seq RESTART WITH 1;
ALTER SEQUENCE public.performance_evaluations_id_seq RESTART WITH 1;
ALTER SEQUENCE public.积分记录_id_seq RESTART WITH 1;
ALTER SEQUENCE public.score_records_id_seq RESTART WITH 1;

-- 验证数据清理结果
SELECT '用户表记录数: ' || COUNT(*) as result FROM public.用户;
SELECT 'users表记录数: ' || COUNT(*) as result FROM public.users;
SELECT '部门管理表记录数: ' || COUNT(*) as result FROM public.部门管理;
SELECT 'departments表记录数: ' || COUNT(*) as result FROM public.departments;
SELECT '奖励积分记录表记录数: ' || COUNT(*) as result FROM public.奖励积分记录;
SELECT 'reward_score_records表记录数: ' || COUNT(*) as result FROM public.reward_score_records;
SELECT '绩效评测表记录数: ' || COUNT(*) as result FROM public.绩效评测;
SELECT 'performance_evaluations表记录数: ' || COUNT(*) as result FROM public.performance_evaluations;