-- 文件名: 030_create_score_calculation_functions.sql
-- 创建积分计算相关的存储过程和函数

-- 计算最终工作实绩积分的函数
-- 积分计算方式：每位普通职工的工作实绩积分 = 所有参加评分测评人员评分测评分数的总和 ÷ 参评人数（精确到小数点后两位）
CREATE OR REPLACE FUNCTION calculate_final_performance_score(
    p_user_id UUID,
    p_period VARCHAR(20)
) RETURNS DECIMAL(6,2) AS $$
DECLARE
    daily_avg DECIMAL(6,2) := 0;
    annual_avg DECIMAL(6,2) := 0;
    final_score DECIMAL(6,2) := 0;
    daily_count INTEGER := 0;
    annual_count INTEGER := 0;
    calculation_info JSONB;
BEGIN
    -- 计算日常实绩评价平均分（所有参评人员评分的平均值）
    SELECT 
        COALESCE(ROUND(AVG(total_score), 2), 0),
        COUNT(*)
    INTO daily_avg, daily_count
    FROM performance_evaluations
    WHERE user_id = p_user_id 
        AND period = p_period 
        AND evaluation_type = 'daily'
        AND status = 'approved';
    
    -- 计算年终集体测评平均分（所有参评人员评分的平均值）
    SELECT 
        COALESCE(ROUND(AVG(total_score), 2), 0),
        COUNT(*)
    INTO annual_avg, annual_count
    FROM performance_evaluations
    WHERE user_id = p_user_id 
        AND period = p_period 
        AND evaluation_type = 'annual'
        AND status = 'approved';
    
    -- 按公式计算最终积分：日常评价平均分×80% + 年终测评平均分×20%（精确到小数点后两位）
    final_score := ROUND(daily_avg * 0.8 + annual_avg * 0.2, 2);
    
    -- 构建计算详情JSON
    calculation_info := jsonb_build_object(
        'daily_score', daily_avg,
        'annual_score', annual_avg,
        'daily_count', daily_count,
        'annual_count', annual_count,
        'formula', 'daily_score * 0.8 + annual_score * 0.2',
        'calculated_at', NOW()
    );
    
    -- 更新或插入最终积分记录
    INSERT INTO final_performance_scores (
        user_id, 
        period, 
        daily_score, 
        annual_score, 
        final_score,
        daily_evaluation_count,
        annual_evaluation_count,
        calculation_details,
        last_calculated_at
    ) VALUES (
        p_user_id, 
        p_period, 
        daily_avg, 
        annual_avg, 
        final_score,
        daily_count,
        annual_count,
        calculation_info,
        NOW()
    )
    ON CONFLICT (user_id, period) 
    DO UPDATE SET
        daily_score = EXCLUDED.daily_score,
        annual_score = EXCLUDED.annual_score,
        final_score = EXCLUDED.final_score,
        daily_evaluation_count = EXCLUDED.daily_evaluation_count,
        annual_evaluation_count = EXCLUDED.annual_evaluation_count,
        calculation_details = EXCLUDED.calculation_details,
        last_calculated_at = EXCLUDED.last_calculated_at,
        updated_at = NOW();
    
    RETURN final_score;
END;
$$ LANGUAGE plpgsql;

-- 批量计算所有用户指定周期的最终积分
CREATE OR REPLACE FUNCTION calculate_all_final_scores(
    p_period VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
    user_record RECORD;
    processed_count INTEGER := 0;
BEGIN
    -- 遍历所有有评价记录的用户
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM performance_evaluations 
        WHERE period = p_period AND status = 'approved'
    LOOP
        PERFORM calculate_final_performance_score(user_record.user_id, p_period);
        processed_count := processed_count + 1;
    END LOOP;
    
    RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器函数，当评价记录状态变为approved时自动重算积分
CREATE OR REPLACE FUNCTION trigger_recalculate_final_score()
RETURNS TRIGGER AS $$
BEGIN
    -- 当评价记录被批准时，重新计算该用户该周期的最终积分
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        PERFORM calculate_final_performance_score(NEW.user_id, NEW.period);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS trigger_performance_evaluation_approved ON performance_evaluations;
CREATE TRIGGER trigger_performance_evaluation_approved
    AFTER UPDATE ON performance_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_final_score();