-- 文件名: 034_create_performance_calculation_functions.sql
-- 创建工作实绩积分计算相关的存储过程和函数

-- 1. 计算用户日常实绩评价平均分的函数
CREATE OR REPLACE FUNCTION calculate_daily_performance_average(
    p_user_id UUID,
    p_evaluation_period VARCHAR(20)
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    avg_score DECIMAL(5,2) := 0;
BEGIN
    SELECT COALESCE(AVG(wtde.total_score), 0)
    INTO avg_score
    FROM work_task_detailed_evaluations wtde
    JOIN work_tasks wt ON wtde.task_id = wt.id
    WHERE wt.user_id = p_user_id
      AND wtde.status = 'approved'
      AND TO_CHAR(wtde.evaluation_date, 'YYYY-MM') = p_evaluation_period;
    
    RETURN avg_score;
END;
$$ LANGUAGE plpgsql;

-- 2. 计算用户年终集体测评平均分的函数
CREATE OR REPLACE FUNCTION calculate_annual_collective_average(
    p_user_id UUID,
    p_evaluation_year INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    avg_score DECIMAL(5,2) := 0;
BEGIN
    SELECT COALESCE(AVG(pe.score), 0)
    INTO avg_score
    FROM performance_evaluations pe
    WHERE pe.evaluated_user_id = p_user_id
      AND pe.evaluation_type = 'annual'
      AND pe.status = 'approved'
      AND EXTRACT(YEAR FROM pe.evaluation_date::DATE) = p_evaluation_year;
    
    RETURN avg_score;
END;
$$ LANGUAGE plpgsql;

-- 3. 更新日常实绩评价汇总的存储过程
CREATE OR REPLACE FUNCTION update_daily_performance_summary(
    p_user_id UUID,
    p_evaluation_period VARCHAR(20)
) RETURNS VOID AS $$
DECLARE
    v_total_tasks INTEGER := 0;
    v_completed_tasks INTEGER := 0;
    v_total_volume_score DECIMAL(6,2) := 0;
    v_total_quality_score DECIMAL(6,2) := 0;
    v_daily_total_score DECIMAL(6,2) := 0;
    v_average_score DECIMAL(5,2) := 0;
    v_completion_rate DECIMAL(5,2) := 0;
BEGIN
    -- 统计任务数量和完成情况
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN wt.status = 'completed' THEN 1 END),
        COALESCE(SUM(wtde.task_volume_score), 0),
        COALESCE(SUM(wtde.task_quality_score), 0),
        COALESCE(SUM(wtde.total_score), 0)
    INTO 
        v_total_tasks,
        v_completed_tasks,
        v_total_volume_score,
        v_total_quality_score,
        v_daily_total_score
    FROM work_tasks wt
    LEFT JOIN work_task_detailed_evaluations wtde ON wt.id = wtde.task_id AND wtde.status = 'approved'
    WHERE wt.user_id = p_user_id
      AND TO_CHAR(wt.created_at, 'YYYY-MM') = p_evaluation_period;
    
    -- 计算平均分和完成率
    IF v_completed_tasks > 0 THEN
        v_average_score := v_daily_total_score / v_completed_tasks;
    END IF;
    
    IF v_total_tasks > 0 THEN
        v_completion_rate := (v_completed_tasks::DECIMAL / v_total_tasks) * 100;
    END IF;
    
    -- 插入或更新汇总记录
    INSERT INTO daily_performance_summary (
        user_id, evaluation_period, total_tasks, completed_tasks,
        total_volume_score, total_quality_score, daily_total_score,
        average_score, completion_rate
    ) VALUES (
        p_user_id, p_evaluation_period, v_total_tasks, v_completed_tasks,
        v_total_volume_score, v_total_quality_score, v_daily_total_score,
        v_average_score, v_completion_rate
    )
    ON CONFLICT (user_id, evaluation_period)
    DO UPDATE SET
        total_tasks = EXCLUDED.total_tasks,
        completed_tasks = EXCLUDED.completed_tasks,
        total_volume_score = EXCLUDED.total_volume_score,
        total_quality_score = EXCLUDED.total_quality_score,
        daily_total_score = EXCLUDED.daily_total_score,
        average_score = EXCLUDED.average_score,
        completion_rate = EXCLUDED.completion_rate,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 4. 更新年终集体测评汇总的存储过程
CREATE OR REPLACE FUNCTION update_annual_collective_summary(
    p_user_id UUID,
    p_evaluation_year INTEGER
) RETURNS VOID AS $$
DECLARE
    v_total_evaluations INTEGER := 0;
    v_average_score DECIMAL(5,2) := 0;
    v_weighted_score DECIMAL(5,2) := 0;
    v_evaluation_rounds INTEGER := 0;
    v_final_annual_score DECIMAL(5,2) := 0;
BEGIN
    -- 统计年终测评情况
    SELECT 
        COUNT(*),
        COALESCE(AVG(pe.score), 0),
        COALESCE(AVG(pe.score * pe.weight_factor), 0),
        COALESCE(MAX(pe.evaluation_round), 1)
    INTO 
        v_total_evaluations,
        v_average_score,
        v_weighted_score,
        v_evaluation_rounds
    FROM performance_evaluations pe
    WHERE pe.evaluated_user_id = p_user_id
      AND pe.evaluation_type = 'annual'
      AND pe.status = 'approved'
      AND EXTRACT(YEAR FROM pe.evaluation_date::DATE) = p_evaluation_year;
    
    -- 计算最终年终分数（考虑权重）
    v_final_annual_score := v_weighted_score;
    
    -- 插入或更新汇总记录
    INSERT INTO annual_collective_summary (
        user_id, evaluation_year, total_evaluations, average_score,
        weighted_score, evaluation_rounds, final_annual_score
    ) VALUES (
        p_user_id, p_evaluation_year, v_total_evaluations, v_average_score,
        v_weighted_score, v_evaluation_rounds, v_final_annual_score
    )
    ON CONFLICT (user_id, evaluation_year)
    DO UPDATE SET
        total_evaluations = EXCLUDED.total_evaluations,
        average_score = EXCLUDED.average_score,
        weighted_score = EXCLUDED.weighted_score,
        evaluation_rounds = EXCLUDED.evaluation_rounds,
        final_annual_score = EXCLUDED.final_annual_score,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. 计算最终工作实绩积分的存储过程
CREATE OR REPLACE FUNCTION calculate_final_work_performance_score(
    p_user_id UUID,
    p_evaluation_year INTEGER
) RETURNS VOID AS $$
DECLARE
    v_daily_score DECIMAL(6,2) := 0;
    v_annual_score DECIMAL(6,2) := 0;
BEGIN
    -- 获取日常实绩评价年度平均分
    SELECT COALESCE(AVG(dps.average_score), 0)
    INTO v_daily_score
    FROM daily_performance_summary dps
    WHERE dps.user_id = p_user_id
      AND EXTRACT(YEAR FROM TO_DATE(dps.evaluation_period, 'YYYY-MM')) = p_evaluation_year;
    
    -- 获取年终集体测评分数
    SELECT COALESCE(acs.final_annual_score, 0)
    INTO v_annual_score
    FROM annual_collective_summary acs
    WHERE acs.user_id = p_user_id
      AND acs.evaluation_year = p_evaluation_year;
    
    -- 插入或更新最终积分记录
    INSERT INTO final_work_performance_scores (
        user_id, evaluation_year, daily_score, annual_score
    ) VALUES (
        p_user_id, p_evaluation_year, v_daily_score, v_annual_score
    )
    ON CONFLICT (user_id, evaluation_year)
    DO UPDATE SET
        daily_score = EXCLUDED.daily_score,
        annual_score = EXCLUDED.annual_score,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. 批量更新所有用户最终积分的存储过程
CREATE OR REPLACE FUNCTION batch_update_final_scores(
    p_evaluation_year INTEGER
) RETURNS VOID AS $$
DECLARE
    user_record RECORD;
    current_rank INTEGER := 1;
BEGIN
    -- 为所有活跃用户计算最终积分
    FOR user_record IN 
        SELECT id FROM users WHERE is_active = true
    LOOP
        PERFORM calculate_final_work_performance_score(user_record.id, p_evaluation_year);
    END LOOP;
    
    -- 更新排名
    WITH ranked_scores AS (
        SELECT 
            user_id,
            ROW_NUMBER() OVER (ORDER BY final_total_score DESC) as rank
        FROM final_work_performance_scores
        WHERE evaluation_year = p_evaluation_year
    )
    UPDATE final_work_performance_scores
    SET ranking = ranked_scores.rank
    FROM ranked_scores
    WHERE final_work_performance_scores.user_id = ranked_scores.user_id
      AND final_work_performance_scores.evaluation_year = p_evaluation_year;
END;
$$ LANGUAGE plpgsql;

-- 7. 检查用户是否有权限查看评价界面的函数
CREATE OR REPLACE FUNCTION check_evaluation_visibility(
    p_user_id UUID,
    p_setting_name VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(50);
    setting_enabled BOOLEAN := false;
    target_roles TEXT[];
BEGIN
    -- 获取用户角色
    SELECT role INTO user_role FROM users WHERE id = p_user_id;
    
    -- 管理员始终有权限
    IF user_role IN ('system_admin', 'assessment_admin') THEN
        RETURN true;
    END IF;
    
    -- 检查权限设置
    SELECT is_enabled, target_roles
    INTO setting_enabled, target_roles
    FROM evaluation_visibility_settings
    WHERE setting_name = p_setting_name;
    
    -- 如果设置不存在，默认允许
    IF NOT FOUND THEN
        RETURN true;
    END IF;
    
    -- 检查是否启用且用户角色在目标角色列表中
    RETURN setting_enabled AND (user_role = ANY(target_roles));
END;
$$ LANGUAGE plpgsql;

-- 8. 获取用户工作实绩统计信息的函数
CREATE OR REPLACE FUNCTION get_user_performance_stats(
    p_user_id UUID,
    p_evaluation_year INTEGER
) RETURNS TABLE (
    daily_avg_score DECIMAL(5,2),
    annual_avg_score DECIMAL(5,2),
    final_score DECIMAL(6,2),
    ranking INTEGER,
    total_tasks INTEGER,
    completed_tasks INTEGER,
    completion_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(AVG(dps.average_score), 0) as daily_avg_score,
        COALESCE(acs.final_annual_score, 0) as annual_avg_score,
        COALESCE(fwps.final_total_score, 0) as final_score,
        COALESCE(fwps.ranking, 0) as ranking,
        COALESCE(SUM(dps.total_tasks), 0)::INTEGER as total_tasks,
        COALESCE(SUM(dps.completed_tasks), 0)::INTEGER as completed_tasks,
        CASE 
            WHEN SUM(dps.total_tasks) > 0 THEN 
                (SUM(dps.completed_tasks)::DECIMAL / SUM(dps.total_tasks) * 100)
            ELSE 0
        END as completion_rate
    FROM users u
    LEFT JOIN daily_performance_summary dps ON u.id = dps.user_id 
        AND EXTRACT(YEAR FROM TO_DATE(dps.evaluation_period, 'YYYY-MM')) = p_evaluation_year
    LEFT JOIN annual_collective_summary acs ON u.id = acs.user_id 
        AND acs.evaluation_year = p_evaluation_year
    LEFT JOIN final_work_performance_scores fwps ON u.id = fwps.user_id 
        AND fwps.evaluation_year = p_evaluation_year
    WHERE u.id = p_user_id
    GROUP BY acs.final_annual_score, fwps.final_total_score, fwps.ranking;
END;
$$ LANGUAGE plpgsql;