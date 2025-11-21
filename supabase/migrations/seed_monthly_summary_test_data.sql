-- 插入测试数据到 monthly_reward_summary 表
-- 用于验证月度汇总功能

-- 首先获取一些用户ID
WITH sample_users AS (
    SELECT id, name 
    FROM users 
    WHERE role IN ('employee', 'leader') 
    LIMIT 5
)
INSERT INTO monthly_reward_summary (
    user_id, 
    year, 
    month, 
    total_rewards, 
    total_score, 
    commendation_score, 
    advanced_score, 
    innovation_score, 
    special_score
)
SELECT 
    su.id,
    2024,
    11,
    FLOOR(RANDOM() * 5) + 1,
    ROUND((RANDOM() * 50)::numeric, 2),
    ROUND((RANDOM() * 20)::numeric, 2),
    ROUND((RANDOM() * 15)::numeric, 2),
    ROUND((RANDOM() * 10)::numeric, 2),
    ROUND((RANDOM() * 5)::numeric, 2)
FROM sample_users su;

-- 插入更多测试数据（不同月份）
WITH sample_users AS (
    SELECT id, name 
    FROM users 
    WHERE role IN ('employee', 'leader') 
    LIMIT 5
)
INSERT INTO monthly_reward_summary (
    user_id, 
    year, 
    month, 
    total_rewards, 
    total_score, 
    commendation_score, 
    advanced_score, 
    innovation_score, 
    special_score
)
SELECT 
    su.id,
    2024,
    10,
    FLOOR(RANDOM() * 4) + 1,
    ROUND((RANDOM() * 45)::numeric, 2),
    ROUND((RANDOM() * 18)::numeric, 2),
    ROUND((RANDOM() * 12)::numeric, 2),
    ROUND((RANDOM() * 8)::numeric, 2),
    ROUND((RANDOM() * 7)::numeric, 2)
FROM sample_users su;

-- 验证插入的数据
SELECT 
    mrs.id,
    u.name as user_name,
    mrs.year,
    mrs.month,
    mrs.total_rewards,
    mrs.total_score,
    mrs.commendation_score,
    mrs.advanced_score,
    mrs.innovation_score,
    mrs.special_score,
    mrs.created_at
FROM monthly_reward_summary mrs
JOIN users u ON mrs.user_id = u.id
ORDER BY mrs.year DESC, mrs.month DESC, mrs.total_score DESC;