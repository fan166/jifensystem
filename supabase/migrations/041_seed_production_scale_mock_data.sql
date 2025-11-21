-- 041_seed_production_scale_mock_data.sql
-- 目的：生成覆盖所有业务模块的生产级别模拟数据（含边界与异常样本）
-- 说明：依赖已清理的空数据库结构（参见 040_cleanup_test_and_mock_data.sql）

BEGIN;

-- 基础部门
WITH dept AS (
  INSERT INTO public.departments (name, description, parent_id, is_active)
  VALUES 
    ('综合部', '综合管理与协调', NULL, TRUE),
    ('财务部', '财务与预算管理', NULL, TRUE),
    ('人事部', '人力资源与培训', NULL, TRUE),
    ('信息化中心', '信息化与系统运维', NULL, TRUE),
    ('后勤保障', '后勤与支持服务', NULL, TRUE),
    ('项目管理办公室', '重大项目统筹推进', NULL, TRUE)
  RETURNING id, name
)
SELECT 1;

-- 管理员与员工用户（约120名）
-- 创建2名系统管理员
WITH admins AS (
  INSERT INTO public.users (email, name, position, department_id, role)
  SELECT 
    'system_admin_' || gs || '@example.com' AS email,
    '系统管理员' || gs AS name,
    '系统管理员' AS position,
    (SELECT id FROM public.departments ORDER BY name LIMIT 1) AS department_id,
    'system_admin' AS role
  FROM generate_series(1,2) gs
  RETURNING id
),
-- 创建8名考核办管理员
assessment_admins AS (
  INSERT INTO public.users (email, name, position, department_id, role)
  SELECT 
    'assessment_admin_' || gs || '@example.com',
    '考核办管理员' || gs,
    '考核办管理员',
    (SELECT id FROM public.departments WHERE name = '综合部' LIMIT 1),
    'assessment_admin'
  FROM generate_series(1,8) gs
  RETURNING id
),
-- 创建110名普通职工，分布到各部门
employees AS (
  INSERT INTO public.users (email, name, position, department_id, role)
  SELECT 
    'employee_' || gs || '@example.com',
    '员工' || lpad(gs::text, 3, '0'),
    CASE WHEN (gs % 5) = 0 THEN '工程师' WHEN (gs % 5) = 1 THEN '财务专员' WHEN (gs % 5) = 2 THEN '人事专员' WHEN (gs % 5) = 3 THEN '项目专员' ELSE '运维专员' END,
    (SELECT id FROM public.departments ORDER BY name OFFSET ((gs-1) % (SELECT count(*) FROM public.departments)) LIMIT 1),
    'employee'
  FROM generate_series(1,110) gs
  RETURNING id
)
SELECT 1;

-- 评分类型（如不存在则插入）
INSERT INTO public.score_types (id, name, category, max_score, min_score, description)
VALUES
  ('basic_duty', '基本职责积分', 'basic_duty', 100, 0, '日常工作基本职责积分'),
  ('work_performance', '工作实绩积分', 'work_performance', 50, 0, '任务完成质量与效率积分'),
  ('key_work', '重点工作积分', 'key_work', 20, 0, '重点工作推进与结果积分'),
  ('reward', '绩效奖励积分', 'reward', 100, 0, '各类奖励记录积分')
ON CONFLICT (id) DO NOTHING;

-- 幂等插入奖励类型（按 name 约束去重）
INSERT INTO public.reward_types (name, category, base_score, max_score, description, is_active)
VALUES
  ('表扬', 'commendation', 5, 10, '一般性表扬', TRUE),
  ('先进个人', 'advanced', 10, 20, '先进个人或先进集体', TRUE),
  ('创新成果', 'innovation', 15, 25, '技术或管理创新成果', TRUE),
  ('专项奖励', 'special', 20, 40, '重大专项或特殊贡献', TRUE)
ON CONFLICT (name) DO NOTHING;
SELECT 1;

-- 公告（15条，覆盖不同优先级与时间窗）
WITH admin_one AS (
  SELECT id FROM public.users WHERE role = 'system_admin' ORDER BY created_at LIMIT 1
), ins AS (
  INSERT INTO public.announcements (title, content, type, priority, is_read, starts_at, ends_at, created_by)
  SELECT 
    '系统通知' || gs,
    '这是第' || gs || '条系统通知，用于测试公告展示与已读状态。',
    CASE WHEN gs % 3 = 0 THEN 'info' WHEN gs % 3 = 1 THEN 'warning' ELSE 'alert' END,
    CASE WHEN gs % 3 = 0 THEN 'low' WHEN gs % 3 = 1 THEN 'medium' ELSE 'high' END,
    FALSE,
    now() - (gs || ' days')::interval,
    now() + ((15 - gs) || ' days')::interval,
    (SELECT id FROM admin_one)
  FROM generate_series(1,15) gs
  RETURNING id
)
SELECT 1;

-- 重点工作（30个）
WITH admin_ids AS (
  SELECT id FROM public.users WHERE role IN ('system_admin','assessment_admin')
), dept_ids AS (
  SELECT id FROM public.departments
), kw AS (
  INSERT INTO public.key_works (
    work_title, work_description, work_type, priority, total_score, status,
    start_date, end_date, actual_completion_date, created_by, department_id,
    is_cross_department, completion_rate, quality_rating
  )
  SELECT 
    '重点工作' || gs,
    '重点工作描述' || gs,
    (ARRAY['major_project','special_activity','difficult_task','innovation_project','emergency_response'])[1 + (random()*4)::int],
    (ARRAY['medium','high','urgent'])[1 + (random()*2)::int],
    round(random()*20)::int,
    (ARRAY['planning','in_progress','completed','cancelled','on_hold'])[1 + (random()*4)::int],
    (current_date - ((gs%60)+10))::date,
    (current_date + ((gs%90)+10))::date,
    NULL,
    (SELECT id FROM admin_ids ORDER BY random() LIMIT 1),
    (SELECT id FROM dept_ids ORDER BY random() LIMIT 1),
    (random() < 0.2),
    round((random()*100)::numeric, 2),
    (ARRAY['excellent','good','average','poor'])[1 + (random()*3)::int]
  FROM generate_series(1,30) gs
  RETURNING id
), participants AS (
  INSERT INTO public.key_work_participants (key_work_id, user_id, role, contribution_description, individual_score, performance_rating, assigned_date, is_active)
  SELECT 
    kw.id,
    u.id,
    (ARRAY['leader','main_participant','participant','supporter','coordinator'])[1 + (random()*4)::int],
    '贡献说明-' || substr(u.id::text,1,8),
    round((random()*20)::numeric,2),
    (ARRAY['outstanding','excellent','good','average','poor'])[1 + (random()*4)::int],
    current_date - ((random()*180)::int),
    TRUE
  FROM kw 
  JOIN public.users u ON u.role = 'employee'
  WHERE random() < 0.08 -- 每个重点工作约6-10名参与者
  RETURNING id, key_work_id, user_id
), progress AS (
  INSERT INTO public.key_work_progress (key_work_id, progress_description, completion_percentage, attachments, reported_by)
  SELECT 
    (SELECT id FROM kw ORDER BY random() LIMIT 1),
    '阶段进展：' || gs,
    10 * ((gs % 10) + 1),
    ARRAY['附件说明' || gs::text],
    (SELECT id FROM public.users ORDER BY random() LIMIT 1)
  FROM generate_series(1,300) gs
  RETURNING id
), kwe AS (
  INSERT INTO public.key_work_evaluations (key_work_id, participant_id, evaluator_id, innovation_score, execution_score, collaboration_score, result_score, total_score, evaluation_comments)
  SELECT 
    p.key_work_id,
    p.id,
    (SELECT id FROM public.users WHERE role IN ('system_admin','assessment_admin') ORDER BY random() LIMIT 1),
    round((random()*5)::numeric,2),
    round((random()*5)::numeric,2),
    round((random()*5)::numeric,2),
    round((random()*5)::numeric,2),
    round((random()*20)::numeric,2),
    '评价意见-' || substr(p.id::text,1,8)
  FROM participants p
  WHERE random() < 0.6
  RETURNING id
)
SELECT 1;

-- 工作任务（2500条）
WITH emp AS (
  SELECT id FROM public.users WHERE role = 'employee'
), adm AS (
  SELECT id FROM public.users WHERE role IN ('system_admin','assessment_admin')
), tasks AS (
  INSERT INTO public.work_tasks (
    user_id, task_title, task_description, task_type, priority, expected_score, actual_score, status,
    start_date, due_date, completion_date, assigned_by, department_id, title, description, assigned_to
  )
  SELECT 
    (SELECT id FROM emp ORDER BY random() LIMIT 1) AS user_id,
    '任务标题-' || gs,
    '任务详情描述-' || gs,
    (ARRAY['daily','weekly','monthly','project','emergency'])[1 + (random()*4)::int],
    (ARRAY['low','medium','high','urgent'])[1 + (random()*3)::int],
    round((random()*50)::numeric,2),
    round((random()*50)::numeric,2),
    (ARRAY['pending','in_progress','completed','cancelled','overdue'])[1 + (random()*4)::int],
    (current_date - ((random()*90)::int))::date,
    (current_date + ((random()*60)::int))::date,
    NULL,
    (SELECT id FROM adm ORDER BY random() LIMIT 1),
    (SELECT department_id FROM public.users WHERE id = (SELECT id FROM emp ORDER BY random() LIMIT 1)),
    '任务标题扩展-' || gs,
    '任务说明扩展-' || gs,
    (SELECT id FROM emp ORDER BY random() LIMIT 1)
  FROM generate_series(1,2500) gs
  RETURNING id, user_id, status
), evals AS (
  INSERT INTO public.work_task_evaluations (
    task_id, evaluator_id, work_volume_score, work_quality_score, total_score, evaluation_comments
  )
  SELECT 
    t.id,
    (SELECT id FROM adm ORDER BY random() LIMIT 1),
    round((random()*30)::numeric,2),
    round((random()*20)::numeric,2),
    round((random()*50)::numeric,2),
    '任务评价-' || substr(t.id::text,1,8)
  FROM tasks t
  WHERE t.status = 'completed' AND random() < 0.6
  RETURNING id
)
SELECT 1;

-- 奖励积分记录（1200条）
WITH emp AS (
  SELECT id FROM public.users WHERE role = 'employee'
), rtypes AS (
  SELECT id FROM public.reward_types
), adm AS (
  SELECT id FROM public.users WHERE role IN ('system_admin','assessment_admin')
), r AS (
  INSERT INTO public.reward_score_records (
    user_id, reward_type_id, title, description, score, award_date, award_period, issuer_id, certificate_number, is_public
  )
  SELECT 
    (SELECT id FROM emp ORDER BY random() LIMIT 1),
    (SELECT id FROM rtypes ORDER BY random() LIMIT 1),
    '奖励标题-' || gs,
    '奖励说明-' || gs,
    round((5 + random()*35)::numeric,2),
    (current_date - ((random()*180)::int))::date,
    to_char((current_date - ((random()*180)::int))::date, 'YYYY-MM'),
    (SELECT id FROM adm ORDER BY random() LIMIT 1),
    'CERT-' || lpad(gs::text, 6, '0'),
    (random() < 0.85)
  FROM generate_series(1,1200) gs
  RETURNING id, user_id, award_date
)
SELECT 1;

-- 月度奖励汇总（按月份与用户聚合）
INSERT INTO public.monthly_reward_summary (user_id, year, month, total_rewards, total_score, commendation_score, advanced_score, innovation_score, special_score)
SELECT 
  user_id,
  EXTRACT(YEAR FROM award_date)::int AS year,
  EXTRACT(MONTH FROM award_date)::int AS month,
  COUNT(*) AS total_rewards,
  LEAST(COALESCE(SUM(score),0), 999.99) AS total_score,
  LEAST(COALESCE(SUM(CASE WHEN rt.category = 'commendation' THEN score ELSE 0 END),0), 999.99) AS commendation_score,
  LEAST(COALESCE(SUM(CASE WHEN rt.category = 'advanced' THEN score ELSE 0 END),0), 999.99) AS advanced_score,
  LEAST(COALESCE(SUM(CASE WHEN rt.category = 'innovation' THEN score ELSE 0 END),0), 999.99) AS innovation_score,
  LEAST(COALESCE(SUM(CASE WHEN rt.category = 'special' THEN score ELSE 0 END),0), 999.99) AS special_score
FROM public.reward_score_records r
JOIN public.reward_types rt ON rt.id = r.reward_type_id
GROUP BY user_id, year, month;

-- 每日绩效汇总（近60天，每个用户一条）
INSERT INTO public.daily_performance_summary (
  user_id, evaluation_period, total_tasks, completed_tasks, total_volume_score, total_quality_score, daily_total_score, average_score, completion_rate
)
SELECT 
  u.id,
  to_char((current_date - gs)::date, 'YYYY-MM-DD'),
  (10 + (random()*20)::int),
  (8 + (random()*15)::int),
  round((random()*60)::numeric,2),
  round((random()*40)::numeric,2),
  round((random()*100)::numeric,2),
  round((random()*10)::numeric,2),
  round((50 + random()*50)::numeric,2)
FROM public.users u
JOIN generate_series(0,59) gs ON TRUE
WHERE u.role = 'employee';

-- 月度绩效汇总（近12个月）
INSERT INTO public.monthly_performance_summary (
  user_id, year, month, total_tasks, completed_tasks, total_work_volume_score, total_work_quality_score, monthly_total_score, completion_rate
)
SELECT 
  u.id,
  EXTRACT(YEAR FROM d)::int AS year,
  EXTRACT(MONTH FROM d)::int AS month,
  (120 + (random()*100)::int),
  (100 + (random()*100)::int),
  round((random()*600)::numeric,2),
  round((random()*400)::numeric,2),
  LEAST(round((random()*1000)::numeric,2), 999.99),
  round((60 + random()*40)::numeric,2)
FROM public.users u
JOIN (
  SELECT (date_trunc('month', current_date) - (gs||' months')::interval)::date AS d
  FROM generate_series(0,11) gs
) m ON TRUE
WHERE u.role = 'employee';

-- 最终绩效得分（近12个月，汇总月度与奖励得分）
INSERT INTO public.final_performance_scores (
  user_id, period, daily_score, annual_score, final_score, calculation_details, daily_evaluation_count, annual_evaluation_count, last_calculated_at, is_final, department_id, total_score
)
SELECT 
  u.id,
  to_char(m.d, 'YYYY-MM') AS period,
  LEAST(COALESCE(mps.monthly_total_score,0), 999.99) AS daily_score,
  0 AS annual_score,
  LEAST(COALESCE(mps.monthly_total_score,0) + COALESCE(mrs.total_score,0), 999.99) AS final_score,
  jsonb_build_object('monthly_total', LEAST(COALESCE(mps.monthly_total_score,0), 999.99), 'monthly_rewards', LEAST(COALESCE(mrs.total_score,0), 999.99)),
  (50 + (random()*50)::int),
  (0 + (random()*10)::int),
  now(),
  FALSE,
  u.department_id,
  LEAST(COALESCE(mps.monthly_total_score,0) + COALESCE(mrs.total_score,0), 999.99)
FROM public.users u
JOIN (
  SELECT (date_trunc('month', current_date) - (gs||' months')::interval)::date AS d
  FROM generate_series(0,11) gs
) m ON TRUE
LEFT JOIN public.monthly_performance_summary mps ON mps.user_id = u.id AND mps.year = EXTRACT(YEAR FROM m.d)::int AND mps.month = EXTRACT(MONTH FROM m.d)::int
LEFT JOIN public.monthly_reward_summary mrs ON mrs.user_id = u.id AND mrs.year = EXTRACT(YEAR FROM m.d)::int AND mrs.month = EXTRACT(MONTH FROM m.d)::int
WHERE u.role = 'employee';

COMMIT;