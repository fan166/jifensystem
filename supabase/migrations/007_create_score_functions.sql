-- 创建积分计算和统计相关的函数

-- 1. 计算用户四大积分模块汇总的函数
CREATE OR REPLACE FUNCTION get_user_score_summary(
    user_uuid UUID,
    period_start DATE DEFAULT NULL,
    period_end DATE DEFAULT NULL
)
RETURNS TABLE(
    user_id UUID,
    user_name VARCHAR,
    department_name VARCHAR,
    basic_duty_score DECIMAL,
    performance_score DECIMAL,
    key_work_score DECIMAL,
    bonus_score DECIMAL,
    total_score DECIMAL,
    calculation_date TIMESTAMP
) AS $$
BEGIN
    -- 设置默认时间范围（当前月份）
    IF period_start IS NULL THEN
        period_start := DATE_TRUNC('month', CURRENT_DATE);
    END IF;
    IF period_end IS NULL THEN
        period_end := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
    END IF;

    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.name as user_name,
        d.name as department_name,
        -- 基本职责积分（从basic_duty_scores表计算）
        COALESCE((
            SELECT SUM(total_score) 
            FROM basic_duty_scores bds 
            WHERE bds.user_id = u.id 
            AND bds.score_date >= period_start 
            AND bds.score_date <= period_end
        ), 0) as basic_duty_score,
        -- 工作实绩积分（从work_tasks表计算平均评分）
        COALESCE((
            SELECT SUM(wt.average_score) 
            FROM work_tasks wt 
            WHERE wt.assigned_to = u.id 
            AND wt.status = 'completed'
            AND wt.completed_at >= period_start::timestamp 
            AND wt.completed_at <= (period_end + INTERVAL '1 day')::timestamp
        ), 0) as performance_score,
        -- 重点工作积分（从key_work_participants表计算）
        COALESCE((
            SELECT SUM(kwp.participation_score) 
            FROM key_work_participants kwp
            JOIN key_works kw ON kwp.key_work_id = kw.id
            WHERE kwp.user_id = u.id 
            AND kwp.completion_status = 'completed'
            AND kw.end_date >= period_start 
            AND kw.end_date <= period_end
        ), 0) as key_work_score,
        -- 绩效奖励积分（从performance_bonuses表计算）
        COALESCE((
            SELECT SUM(pb.score_value) 
            FROM performance_bonuses pb 
            WHERE pb.user_id = u.id 
            AND pb.award_date >= period_start 
            AND pb.award_date <= period_end
        ), 0) as bonus_score,
        -- 总积分
        COALESCE((
            SELECT SUM(total_score) 
            FROM basic_duty_scores bds 
            WHERE bds.user_id = u.id 
            AND bds.score_date >= period_start 
            AND bds.score_date <= period_end
        ), 0) + 
        COALESCE((
            SELECT SUM(wt.average_score) 
            FROM work_tasks wt 
            WHERE wt.assigned_to = u.id 
            AND wt.status = 'completed'
            AND wt.completed_at >= period_start::timestamp 
            AND wt.completed_at <= (period_end + INTERVAL '1 day')::timestamp
        ), 0) + 
        COALESCE((
            SELECT SUM(kwp.participation_score) 
            FROM key_work_participants kwp
            JOIN key_works kw ON kwp.key_work_id = kw.id
            WHERE kwp.user_id = u.id 
            AND kwp.completion_status = 'completed'
            AND kw.end_date >= period_start 
            AND kw.end_date <= period_end
        ), 0) + 
        COALESCE((
            SELECT SUM(pb.score_value) 
            FROM performance_bonuses pb 
            WHERE pb.user_id = u.id 
            AND pb.award_date >= period_start 
            AND pb.award_date <= period_end
        ), 0) as total_score,
        NOW() as calculation_date
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE u.id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- 2. 计算部门积分排名的函数
CREATE OR REPLACE FUNCTION get_department_ranking(
    period_start DATE DEFAULT NULL,
    period_end DATE DEFAULT NULL
)
RETURNS TABLE(
    department_id UUID,
    department_name VARCHAR,
    total_users INTEGER,
    avg_basic_duty_score DECIMAL,
    avg_performance_score DECIMAL,
    avg_key_work_score DECIMAL,
    avg_bonus_score DECIMAL,
    avg_total_score DECIMAL,
    department_rank INTEGER
) AS $$
BEGIN
    -- 设置默认时间范围（当前月份）
    IF period_start IS NULL THEN
        period_start := DATE_TRUNC('month', CURRENT_DATE);
    END IF;
    IF period_end IS NULL THEN
        period_end := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
    END IF;

    RETURN QUERY
    WITH department_scores AS (
        SELECT 
            d.id as dept_id,
            d.name as dept_name,
            COUNT(u.id) as user_count,
            AVG(COALESCE((
                SELECT SUM(total_score) 
                FROM basic_duty_scores bds 
                WHERE bds.user_id = u.id 
                AND bds.score_date >= period_start 
                AND bds.score_date <= period_end
            ), 0)) as avg_basic_duty,
            AVG(COALESCE((
                SELECT SUM(wt.average_score) 
                FROM work_tasks wt 
                WHERE wt.assigned_to = u.id 
                AND wt.status = 'completed'
                AND wt.completed_at >= period_start::timestamp 
                AND wt.completed_at <= (period_end + INTERVAL '1 day')::timestamp
            ), 0)) as avg_performance,
            AVG(COALESCE((
                SELECT SUM(kwp.participation_score) 
                FROM key_work_participants kwp
                JOIN key_works kw ON kwp.key_work_id = kw.id
                WHERE kwp.user_id = u.id 
                AND kwp.completion_status = 'completed'
                AND kw.end_date >= period_start 
                AND kw.end_date <= period_end
            ), 0)) as avg_key_work,
            AVG(COALESCE((
                SELECT SUM(pb.score_value) 
                FROM performance_bonuses pb 
                WHERE pb.user_id = u.id 
                AND pb.award_date >= period_start 
                AND pb.award_date <= period_end
            ), 0)) as avg_bonus
        FROM departments d
        LEFT JOIN users u ON d.id = u.department_id
        WHERE u.id IS NOT NULL
        GROUP BY d.id, d.name
    )
    SELECT 
        ds.dept_id,
        ds.dept_name,
        ds.user_count::INTEGER,
        ROUND(ds.avg_basic_duty, 2),
        ROUND(ds.avg_performance, 2),
        ROUND(ds.avg_key_work, 2),
        ROUND(ds.avg_bonus, 2),
        ROUND(ds.avg_basic_duty + ds.avg_performance + ds.avg_key_work + ds.avg_bonus, 2) as avg_total,
        ROW_NUMBER() OVER (ORDER BY (ds.avg_basic_duty + ds.avg_performance + ds.avg_key_work + ds.avg_bonus) DESC)::INTEGER
    FROM department_scores ds
    ORDER BY avg_total DESC;
END;
$$ LANGUAGE plpgsql;

-- 3. 计算用户积分趋势的函数（最近6个月）
CREATE OR REPLACE FUNCTION get_user_score_trend(
    user_uuid UUID,
    months_back INTEGER DEFAULT 6
)
RETURNS TABLE(
    month_period VARCHAR,
    basic_duty_score DECIMAL,
    performance_score DECIMAL,
    key_work_score DECIMAL,
    bonus_score DECIMAL,
    total_score DECIMAL
) AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    current_month DATE;
BEGIN
    -- 计算开始日期（往前推months_back个月）
    start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * months_back);
    end_date := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day';
    
    -- 生成月份序列并计算每月积分
    FOR current_month IN 
        SELECT generate_series(start_date, end_date, '1 month'::interval)::date
    LOOP
        RETURN QUERY
        SELECT 
            TO_CHAR(current_month, 'YYYY-MM') as month_period,
            COALESCE((
                SELECT SUM(total_score) 
                FROM basic_duty_scores bds 
                WHERE bds.user_id = user_uuid 
                AND bds.score_date >= current_month 
                AND bds.score_date < current_month + INTERVAL '1 month'
            ), 0) as basic_duty_score,
            COALESCE((
                SELECT SUM(wt.average_score) 
                FROM work_tasks wt 
                WHERE wt.assigned_to = user_uuid 
                AND wt.status = 'completed'
                AND wt.completed_at >= current_month::timestamp 
                AND wt.completed_at < (current_month + INTERVAL '1 month')::timestamp
            ), 0) as performance_score,
            COALESCE((
                SELECT SUM(kwp.participation_score) 
                FROM key_work_participants kwp
                JOIN key_works kw ON kwp.key_work_id = kw.id
                WHERE kwp.user_id = user_uuid 
                AND kwp.completion_status = 'completed'
                AND kw.end_date >= current_month 
                AND kw.end_date < current_month + INTERVAL '1 month'
            ), 0) as key_work_score,
            COALESCE((
                SELECT SUM(pb.score_value) 
                FROM performance_bonuses pb 
                WHERE pb.user_id = user_uuid 
                AND pb.award_date >= current_month 
                AND pb.award_date < current_month + INTERVAL '1 month'
            ), 0) as bonus_score,
            -- 计算总分
            COALESCE((
                SELECT SUM(total_score) 
                FROM basic_duty_scores bds 
                WHERE bds.user_id = user_uuid 
                AND bds.score_date >= current_month 
                AND bds.score_date < current_month + INTERVAL '1 month'
            ), 0) + 
            COALESCE((
                SELECT SUM(wt.average_score) 
                FROM work_tasks wt 
                WHERE wt.assigned_to = user_uuid 
                AND wt.status = 'completed'
                AND wt.completed_at >= current_month::timestamp 
                AND wt.completed_at < (current_month + INTERVAL '1 month')::timestamp
            ), 0) + 
            COALESCE((
                SELECT SUM(kwp.participation_score) 
                FROM key_work_participants kwp
                JOIN key_works kw ON kwp.key_work_id = kw.id
                WHERE kwp.user_id = user_uuid 
                AND kwp.completion_status = 'completed'
                AND kw.end_date >= current_month 
                AND kw.end_date < current_month + INTERVAL '1 month'
            ), 0) + 
            COALESCE((
                SELECT SUM(pb.score_value) 
                FROM performance_bonuses pb 
                WHERE pb.user_id = user_uuid 
                AND pb.award_date >= current_month 
                AND pb.award_date < current_month + INTERVAL '1 month'
            ), 0) as total_score;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. 更新工作任务平均评分的函数
CREATE OR REPLACE FUNCTION update_task_average_score(task_uuid UUID)
RETURNS VOID AS $$
DECLARE
    avg_score DECIMAL;
    eval_count INTEGER;
BEGIN
    -- 计算该任务的平均评分和评价数量
    SELECT 
        COALESCE(AVG(score), 0),
        COUNT(*)
    INTO avg_score, eval_count
    FROM work_task_evaluations 
    WHERE task_id = task_uuid;
    
    -- 更新工作任务表中的平均分和评价数量
    UPDATE work_tasks 
    SET 
        average_score = avg_score,
        evaluation_count = eval_count,
        updated_at = NOW()
    WHERE id = task_uuid;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器：当工作任务评价发生变化时自动更新平均分
CREATE OR REPLACE FUNCTION trigger_update_task_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 对于INSERT和UPDATE操作
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_task_average_score(NEW.task_id);
        RETURN NEW;
    END IF;
    
    -- 对于DELETE操作
    IF TG_OP = 'DELETE' THEN
        PERFORM update_task_average_score(OLD.task_id);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_task_score_trigger ON work_task_evaluations;
CREATE TRIGGER update_task_score_trigger
    AFTER INSERT OR UPDATE OR DELETE ON work_task_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_task_score();

-- 6. 计算最终绩效得分并插入final_performance_scores表的函数
CREATE OR REPLACE FUNCTION calculate_final_performance_scores(
    evaluation_period VARCHAR,
    period_start DATE,
    period_end DATE
)
RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    calculated_count INTEGER := 0;
BEGIN
    -- 遍历所有用户计算最终绩效得分
    FOR user_record IN 
        SELECT id FROM users WHERE id IS NOT NULL
    LOOP
        -- 插入或更新最终绩效得分
        INSERT INTO final_performance_scores (
            user_id,
            evaluation_period,
            basic_duty_score,
            performance_score,
            key_work_score,
            bonus_score,
            total_score,
            calculated_by
        )
        SELECT 
            user_id,
            evaluation_period,
            basic_duty_score,
            performance_score,
            key_work_score,
            bonus_score,
            total_score,
            auth.uid()
        FROM get_user_score_summary(user_record.id, period_start, period_end)
        ON CONFLICT (user_id, evaluation_period) 
        DO UPDATE SET
            basic_duty_score = EXCLUDED.basic_duty_score,
            performance_score = EXCLUDED.performance_score,
            key_work_score = EXCLUDED.key_work_score,
            bonus_score = EXCLUDED.bonus_score,
            total_score = EXCLUDED.total_score,
            calculated_at = NOW(),
            calculated_by = auth.uid();
            
        calculated_count := calculated_count + 1;
    END LOOP;
    
    -- 更新排名
    WITH ranked_scores AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY total_score DESC) as new_ranking
        FROM final_performance_scores 
        WHERE evaluation_period = calculate_final_performance_scores.evaluation_period
    )
    UPDATE final_performance_scores fps
    SET ranking = rs.new_ranking
    FROM ranked_scores rs
    WHERE fps.id = rs.id;
    
    RETURN calculated_count;
END;
$$ LANGUAGE plpgsql;