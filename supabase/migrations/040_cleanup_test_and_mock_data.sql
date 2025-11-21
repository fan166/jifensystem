-- 清理现有测试/模拟数据（保留表结构）
-- 说明：使用 TRUNCATE ... CASCADE 清空主要业务表数据，同时重置序列。
-- 注意：保留配置/权限相关表与备份表（backup_*）。

BEGIN;

-- 禁用会话的触发器（谨慎）可按需启用；一般 TRUNCATE 不需要
-- SET session_replication_role = replica;

TRUNCATE TABLE 
  public.reward_score_records,
  public.reward_applications,
  public.reward_approval_flows,
  public.monthly_reward_summary,
  public.work_task_detailed_evaluations,
  public.work_task_evaluations,
  public.work_tasks,
  public.key_work_progress,
  public.key_work_milestones,
  public.key_work_evaluations,
  public.key_work_participants,
  public.key_works,
  public.performance_evaluations,
  public.final_performance_scores,
  public.evaluations,
  public.scores,
  public.basic_duty_scores,
  public.basic_duty_score_history,
  public.basic_duty_import_batches,
  public.monthly_performance_summary,
  public.daily_performance_summary,
  public.annual_collective_summary,
  public.operation_logs,
  public.announcements,
  public.users,
  public.departments
RESTART IDENTITY CASCADE;

-- 还原触发器（如曾禁用）
-- SET session_replication_role = origin;

COMMIT;

COMMENT ON SCHEMA public IS '清理测试/模拟数据完成：保留结构，仅清空业务数据';