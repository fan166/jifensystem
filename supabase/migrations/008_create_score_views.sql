-- 创建积分汇总视图和辅助视图

-- 1. 用户积分汇总视图（当前月份）
CREATE OR REPLACE VIEW user_score_summary_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.position,
    d.name as department_name,
    d.id as department_id,
    -- 基本职责积分
    COALESCE((
        SELECT SUM(total_score) 
        FROM basic_duty_scores bds 
        WHERE bds.user_id = u.id 
        AND bds.score_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND bds.score_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
    ), 0) as basic_duty_score,
    -- 工作实绩积分
    COALESCE((
        SELECT SUM(wt.average_score) 
        FROM work_tasks wt 
        WHERE wt.assigned_to = u.id 
        AND wt.status = 'completed'
        AND wt.completed_at >= DATE_TRUNC('month', CURRENT_DATE)::timestamp 
        AND wt.completed_at <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp
    ), 0) as performance_score,
    -- 重点工作积分
    COALESCE((
        SELECT SUM(kwp.participation_score) 
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE kwp.user_id = u.id 
        AND kwp.completion_status = 'completed'
        AND kw.end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND kw.end_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0) as key_work_score,
    -- 绩效奖励积分
    COALESCE((
        SELECT SUM(pb.score_value) 
        FROM performance_bonuses pb 
        WHERE pb.user_id = u.id 
        AND pb.award_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND pb.award_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0) as bonus_score,
    -- 总积分
    COALESCE((
        SELECT SUM(total_score) 
        FROM basic_duty_scores bds 
        WHERE bds.user_id = u.id 
        AND bds.score_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND bds.score_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
    ), 0) + 
    COALESCE((
        SELECT SUM(wt.average_score) 
        FROM work_tasks wt 
        WHERE wt.assigned_to = u.id 
        AND wt.status = 'completed'
        AND wt.completed_at >= DATE_TRUNC('month', CURRENT_DATE)::timestamp 
        AND wt.completed_at <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp
    ), 0) + 
    COALESCE((
        SELECT SUM(kwp.participation_score) 
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE kwp.user_id = u.id 
        AND kwp.completion_status = 'completed'
        AND kw.end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND kw.end_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0) + 
    COALESCE((
        SELECT SUM(pb.score_value) 
        FROM performance_bonuses pb 
        WHERE pb.user_id = u.id 
        AND pb.award_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND pb.award_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0) as total_score,
    -- 排名（基于总积分）
    ROW_NUMBER() OVER (ORDER BY (
        COALESCE((
            SELECT SUM(total_score) 
            FROM basic_duty_scores bds 
            WHERE bds.user_id = u.id 
            AND bds.score_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND bds.score_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
        ), 0) + 
        COALESCE((
            SELECT SUM(wt.average_score) 
            FROM work_tasks wt 
            WHERE wt.assigned_to = u.id 
            AND wt.status = 'completed'
            AND wt.completed_at >= DATE_TRUNC('month', CURRENT_DATE)::timestamp 
            AND wt.completed_at <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp
        ), 0) + 
        COALESCE((
            SELECT SUM(kwp.participation_score) 
            FROM key_work_participants kwp
            JOIN key_works kw ON kwp.key_work_id = kw.id
            WHERE kwp.user_id = u.id 
            AND kwp.completion_status = 'completed'
            AND kw.end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
            AND kw.end_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ), 0) + 
        COALESCE((
            SELECT SUM(pb.score_value) 
            FROM performance_bonuses pb 
            WHERE pb.user_id = u.id 
            AND pb.award_date >= DATE_TRUNC('month', CURRENT_DATE)::date
            AND pb.award_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ), 0)
    ) DESC) as ranking,
    CURRENT_DATE as calculation_date
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
WHERE u.id IS NOT NULL;

-- 2. 部门积分汇总视图（当前月份）
CREATE OR REPLACE VIEW department_score_summary_view AS
SELECT 
    d.id as department_id,
    d.name as department_name,
    COUNT(u.id) as total_users,
    -- 部门平均基本职责积分
    AVG(COALESCE((
        SELECT SUM(total_score) 
        FROM basic_duty_scores bds 
        WHERE bds.user_id = u.id 
        AND bds.score_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND bds.score_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
    ), 0)) as avg_basic_duty_score,
    -- 部门平均工作实绩积分
    AVG(COALESCE((
        SELECT SUM(wt.average_score) 
        FROM work_tasks wt 
        WHERE wt.assigned_to = u.id 
        AND wt.status = 'completed'
        AND wt.completed_at >= DATE_TRUNC('month', CURRENT_DATE)::timestamp 
        AND wt.completed_at <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp
    ), 0)) as avg_performance_score,
    -- 部门平均重点工作积分
    AVG(COALESCE((
        SELECT SUM(kwp.participation_score) 
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE kwp.user_id = u.id 
        AND kwp.completion_status = 'completed'
        AND kw.end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND kw.end_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0)) as avg_key_work_score,
    -- 部门平均绩效奖励积分
    AVG(COALESCE((
        SELECT SUM(pb.score_value) 
        FROM performance_bonuses pb 
        WHERE pb.user_id = u.id 
        AND pb.award_date >= DATE_TRUNC('month', CURRENT_DATE)::date
        AND pb.award_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    ), 0)) as avg_bonus_score,
    -- 部门平均总积分
    AVG(
        COALESCE((
            SELECT SUM(total_score) 
            FROM basic_duty_scores bds 
            WHERE bds.user_id = u.id 
            AND bds.score_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND bds.score_date <= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
        ), 0) + 
        COALESCE((
            SELECT SUM(wt.average_score) 
            FROM work_tasks wt 
            WHERE wt.assigned_to = u.id 
            AND wt.status = 'completed'
            AND wt.completed_at >= DATE_TRUNC('month', CURRENT_DATE)::timestamp 
            AND wt.completed_at <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamp
        ), 0) + 
        COALESCE((
            SELECT SUM(kwp.participation_score) 
            FROM key_work_participants kwp
            JOIN key_works kw ON kwp.key_work_id = kw.id
            WHERE kwp.user_id = u.id 
            AND kwp.completion_status = 'completed'
            AND kw.end_date >= DATE_TRUNC('month', CURRENT_DATE)::date
            AND kw.end_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ), 0) + 
        COALESCE((
            SELECT SUM(pb.score_value) 
            FROM performance_bonuses pb 
            WHERE pb.user_id = u.id 
            AND pb.award_date >= DATE_TRUNC('month', CURRENT_DATE)::date
            AND pb.award_date <= (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
        ), 0)
    ) as avg_total_score,
    CURRENT_DATE as calculation_date
FROM departments d
LEFT JOIN users u ON d.id = u.department_id
WHERE u.id IS NOT NULL
GROUP BY d.id, d.name
ORDER BY avg_total_score DESC;

-- 3. 工作任务统计视图
CREATE OR REPLACE VIEW work_task_statistics_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    d.name as department_name,
    COUNT(wt.id) as total_tasks,
    COUNT(CASE WHEN wt.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN wt.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN wt.status = 'pending' THEN 1 END) as pending_tasks,
    ROUND(AVG(CASE WHEN wt.status = 'completed' THEN wt.average_score END), 2) as avg_task_score,
    SUM(CASE WHEN wt.status = 'completed' THEN wt.average_score ELSE 0 END) as total_performance_score
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN work_tasks wt ON u.id = wt.assigned_to
WHERE u.id IS NOT NULL
GROUP BY u.id, u.name, d.name
ORDER BY total_performance_score DESC;

-- 4. 重点工作参与统计视图
CREATE OR REPLACE VIEW key_work_participation_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    d.name as department_name,
    COUNT(kwp.id) as total_participations,
    COUNT(CASE WHEN kwp.completion_status = 'completed' THEN 1 END) as completed_participations,
    COUNT(CASE WHEN kwp.completion_status = 'in_progress' THEN 1 END) as in_progress_participations,
    COUNT(CASE WHEN kwp.completion_status = 'assigned' THEN 1 END) as assigned_participations,
    SUM(CASE WHEN kwp.completion_status = 'completed' THEN kwp.participation_score ELSE 0 END) as total_key_work_score,
    ROUND(AVG(CASE WHEN kwp.completion_status = 'completed' THEN kwp.participation_score END), 2) as avg_participation_score
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN key_work_participants kwp ON u.id = kwp.user_id
WHERE u.id IS NOT NULL
GROUP BY u.id, u.name, d.name
ORDER BY total_key_work_score DESC;

-- 5. 绩效奖励统计视图
CREATE OR REPLACE VIEW performance_bonus_statistics_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    d.name as department_name,
    COUNT(pb.id) as total_bonuses,
    COUNT(CASE WHEN pb.bonus_type = 'commendation' THEN 1 END) as commendation_count,
    COUNT(CASE WHEN pb.bonus_type = 'advanced' THEN 1 END) as advanced_count,
    COUNT(CASE WHEN pb.bonus_type = 'special' THEN 1 END) as special_count,
    COUNT(CASE WHEN pb.bonus_type = 'innovation' THEN 1 END) as innovation_count,
    SUM(pb.score_value) as total_bonus_score,
    ROUND(AVG(pb.score_value), 2) as avg_bonus_score
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN performance_bonuses pb ON u.id = pb.user_id
WHERE u.id IS NOT NULL
GROUP BY u.id, u.name, d.name
ORDER BY total_bonus_score DESC;

-- 为视图设置权限
GRANT SELECT ON user_score_summary_view TO anon;
GRANT SELECT ON user_score_summary_view TO authenticated;

GRANT SELECT ON department_score_summary_view TO anon;
GRANT SELECT ON department_score_summary_view TO authenticated;

GRANT SELECT ON work_task_statistics_view TO anon;
GRANT SELECT ON work_task_statistics_view TO authenticated;

GRANT SELECT ON key_work_participation_view TO anon;
GRANT SELECT ON key_work_participation_view TO authenticated;

GRANT SELECT ON performance_bonus_statistics_view TO anon;
GRANT SELECT ON performance_bonus_statistics_view TO authenticated;