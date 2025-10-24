-- 积分制绩效管理系统 - 统计函数和视图
-- 创建时间: 2024-01-20
-- 描述: 创建积分统计函数、视图和存储过程

-- 1. 创建用户积分统计函数
CREATE OR REPLACE FUNCTION get_user_score_summary(user_uuid UUID, score_period VARCHAR DEFAULT NULL)
RETURNS TABLE(
    user_id UUID,
    user_name VARCHAR,
    department_name VARCHAR,
    basic_duty_score DECIMAL,
    performance_score DECIMAL,
    key_work_score DECIMAL,
    bonus_score DECIMAL,
    total_score DECIMAL,
    period VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.name as user_name,
        d.name as department_name,
        COALESCE(bds.total_score, 0) as basic_duty_score,
        COALESCE(ps.performance_score, 0) as performance_score,
        COALESCE(kws.key_work_score, 0) as key_work_score,
        COALESCE(pbs.bonus_score, 0) as bonus_score,
        COALESCE(bds.total_score, 0) + COALESCE(ps.performance_score, 0) + 
        COALESCE(kws.key_work_score, 0) + COALESCE(pbs.bonus_score, 0) as total_score,
        COALESCE(score_period, to_char(CURRENT_DATE, 'YYYY-MM')) as period
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN (
        SELECT user_id, total_score 
        FROM basic_duty_scores 
        WHERE (score_period IS NULL OR period = score_period)
        AND user_id = user_uuid
    ) bds ON u.id = bds.user_id
    LEFT JOIN (
        SELECT 
            pe.evaluated_id as user_id,
            AVG(pe.work_quantity_score + pe.work_quality_score) as performance_score
        FROM performance_evaluations pe
        JOIN work_tasks wt ON pe.task_id = wt.id
        WHERE (score_period IS NULL OR pe.evaluation_period = score_period)
        AND pe.evaluated_id = user_uuid
        GROUP BY pe.evaluated_id
    ) ps ON u.id = ps.user_id
    LEFT JOIN (
        SELECT 
            kwp.user_id,
            SUM(kwp.score) as key_work_score
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE kwp.user_id = user_uuid
        AND (score_period IS NULL OR 
             to_char(kw.created_at, 'YYYY-MM') = score_period)
        GROUP BY kwp.user_id
    ) kws ON u.id = kws.user_id
    LEFT JOIN (
        SELECT 
            user_id,
            SUM(score) as bonus_score
        FROM performance_bonuses
        WHERE (score_period IS NULL OR period = score_period)
        AND user_id = user_uuid
        GROUP BY user_id
    ) pbs ON u.id = pbs.user_id
    WHERE u.id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建部门积分排名函数
CREATE OR REPLACE FUNCTION get_department_ranking(score_period VARCHAR DEFAULT NULL)
RETURNS TABLE(
    department_id UUID,
    department_name VARCHAR,
    user_count BIGINT,
    avg_basic_duty_score DECIMAL,
    avg_performance_score DECIMAL,
    avg_key_work_score DECIMAL,
    avg_bonus_score DECIMAL,
    avg_total_score DECIMAL,
    total_department_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id as department_id,
        d.name as department_name,
        COUNT(u.id) as user_count,
        AVG(COALESCE(bds.total_score, 0)) as avg_basic_duty_score,
        AVG(COALESCE(ps.performance_score, 0)) as avg_performance_score,
        AVG(COALESCE(kws.key_work_score, 0)) as avg_key_work_score,
        AVG(COALESCE(pbs.bonus_score, 0)) as avg_bonus_score,
        AVG(
            COALESCE(bds.total_score, 0) + COALESCE(ps.performance_score, 0) + 
            COALESCE(kws.key_work_score, 0) + COALESCE(pbs.bonus_score, 0)
        ) as avg_total_score,
        SUM(
            COALESCE(bds.total_score, 0) + COALESCE(ps.performance_score, 0) + 
            COALESCE(kws.key_work_score, 0) + COALESCE(pbs.bonus_score, 0)
        ) as total_department_score
    FROM departments d
    LEFT JOIN users u ON d.id = u.department_id AND u.is_active = true
    LEFT JOIN (
        SELECT user_id, total_score 
        FROM basic_duty_scores 
        WHERE (score_period IS NULL OR period = score_period)
    ) bds ON u.id = bds.user_id
    LEFT JOIN (
        SELECT 
            pe.evaluated_id as user_id,
            AVG(pe.work_quantity_score + pe.work_quality_score) as performance_score
        FROM performance_evaluations pe
        WHERE (score_period IS NULL OR pe.evaluation_period = score_period)
        GROUP BY pe.evaluated_id
    ) ps ON u.id = ps.user_id
    LEFT JOIN (
        SELECT 
            kwp.user_id,
            SUM(kwp.score) as key_work_score
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE (score_period IS NULL OR 
               to_char(kw.created_at, 'YYYY-MM') = score_period)
        GROUP BY kwp.user_id
    ) kws ON u.id = kws.user_id
    LEFT JOIN (
        SELECT 
            user_id,
            SUM(score) as bonus_score
        FROM performance_bonuses
        WHERE (score_period IS NULL OR period = score_period)
        GROUP BY user_id
    ) pbs ON u.id = pbs.user_id
    WHERE d.parent_id IS NULL OR d.parent_id IS NOT NULL
    GROUP BY d.id, d.name
    ORDER BY avg_total_score DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建个人积分趋势函数
CREATE OR REPLACE FUNCTION get_user_score_trend(user_uuid UUID, months_count INTEGER DEFAULT 6)
RETURNS TABLE(
    period VARCHAR,
    basic_duty_score DECIMAL,
    performance_score DECIMAL,
    key_work_score DECIMAL,
    bonus_score DECIMAL,
    total_score DECIMAL
) AS $$
DECLARE
    start_date DATE;
    current_period VARCHAR;
BEGIN
    start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * months_count);
    
    RETURN QUERY
    WITH period_series AS (
        SELECT to_char(generate_series(start_date, CURRENT_DATE, '1 month'::interval), 'YYYY-MM') as period
    )
    SELECT 
        ps.period,
        COALESCE(bds.total_score, 0) as basic_duty_score,
        COALESCE(perf.performance_score, 0) as performance_score,
        COALESCE(kws.key_work_score, 0) as key_work_score,
        COALESCE(pbs.bonus_score, 0) as bonus_score,
        COALESCE(bds.total_score, 0) + COALESCE(perf.performance_score, 0) + 
        COALESCE(kws.key_work_score, 0) + COALESCE(pbs.bonus_score, 0) as total_score
    FROM period_series ps
    LEFT JOIN (
        SELECT period, total_score 
        FROM basic_duty_scores 
        WHERE user_id = user_uuid
    ) bds ON ps.period = bds.period
    LEFT JOIN (
        SELECT 
            evaluation_period as period,
            AVG(work_quantity_score + work_quality_score) as performance_score
        FROM performance_evaluations
        WHERE evaluated_id = user_uuid
        GROUP BY evaluation_period
    ) perf ON ps.period = perf.period
    LEFT JOIN (
        SELECT 
            to_char(kw.created_at, 'YYYY-MM') as period,
            SUM(kwp.score) as key_work_score
        FROM key_work_participants kwp
        JOIN key_works kw ON kwp.key_work_id = kw.id
        WHERE kwp.user_id = user_uuid
        GROUP BY to_char(kw.created_at, 'YYYY-MM')
    ) kws ON ps.period = kws.period
    LEFT JOIN (
        SELECT 
            period,
            SUM(score) as bonus_score
        FROM performance_bonuses
        WHERE user_id = user_uuid
        GROUP BY period
    ) pbs ON ps.period = pbs.period
    ORDER BY ps.period;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建工作实绩评价统计函数
CREATE OR REPLACE FUNCTION get_performance_evaluation_stats(user_uuid UUID DEFAULT NULL, eval_period VARCHAR DEFAULT NULL)
RETURNS TABLE(
    task_id UUID,
    task_title VARCHAR,
    user_id UUID,
    user_name VARCHAR,
    evaluator_count BIGINT,
    avg_quantity_score DECIMAL,
    avg_quality_score DECIMAL,
    total_performance_score DECIMAL,
    task_status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wt.id as task_id,
        wt.title as task_title,
        u.id as user_id,
        u.name as user_name,
        COUNT(pe.id) as evaluator_count,
        AVG(pe.work_quantity_score) as avg_quantity_score,
        AVG(pe.work_quality_score) as avg_quality_score,
        AVG(pe.work_quantity_score + pe.work_quality_score) as total_performance_score,
        wt.status as task_status
    FROM work_tasks wt
    JOIN users u ON wt.user_id = u.id
    LEFT JOIN performance_evaluations pe ON wt.id = pe.task_id
    WHERE (user_uuid IS NULL OR u.id = user_uuid)
    AND (eval_period IS NULL OR pe.evaluation_period = eval_period)
    GROUP BY wt.id, wt.title, u.id, u.name, wt.status
    ORDER BY total_performance_score DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建积分汇总视图
CREATE OR REPLACE VIEW user_score_summary_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.position,
    d.name as department_name,
    u.roles,
    COALESCE(bds.total_score, 0) as basic_duty_score,
    COALESCE(ps.performance_score, 0) as performance_score,
    COALESCE(kws.key_work_score, 0) as key_work_score,
    COALESCE(pbs.bonus_score, 0) as bonus_score,
    COALESCE(bds.total_score, 0) + COALESCE(ps.performance_score, 0) + 
    COALESCE(kws.key_work_score, 0) + COALESCE(pbs.bonus_score, 0) as total_score,
    to_char(CURRENT_DATE, 'YYYY-MM') as current_period
FROM users u
LEFT JOIN departments d ON u.department_id = d.id
LEFT JOIN (
    SELECT 
        user_id, 
        total_score 
    FROM basic_duty_scores 
    WHERE period = to_char(CURRENT_DATE, 'YYYY-MM')
) bds ON u.id = bds.user_id
LEFT JOIN (
    SELECT 
        pe.evaluated_id as user_id,
        AVG(pe.work_quantity_score + pe.work_quality_score) as performance_score
    FROM performance_evaluations pe
    WHERE pe.evaluation_period = to_char(CURRENT_DATE, 'YYYY-MM')
    GROUP BY pe.evaluated_id
) ps ON u.id = ps.user_id
LEFT JOIN (
    SELECT 
        kwp.user_id,
        SUM(kwp.score) as key_work_score
    FROM key_work_participants kwp
    JOIN key_works kw ON kwp.key_work_id = kw.id
    WHERE to_char(kw.created_at, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')
    GROUP BY kwp.user_id
) kws ON u.id = kws.user_id
LEFT JOIN (
    SELECT 
        user_id,
        SUM(score) as bonus_score
    FROM performance_bonuses
    WHERE period = to_char(CURRENT_DATE, 'YYYY-MM')
    GROUP BY user_id
) pbs ON u.id = pbs.user_id
WHERE u.is_active = true;

-- 6. 创建更新时间戳触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 为相关表添加更新时间戳触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_basic_duty_scores_updated_at BEFORE UPDATE ON basic_duty_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_tasks_updated_at BEFORE UPDATE ON work_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_key_works_updated_at BEFORE UPDATE ON key_works
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();