-- 修复score_type_id的UUID格式错误
-- 问题：score_types表的id字段是VARCHAR类型，但在某些查询中被错误地当作UUID处理

-- 首先检查当前的数据类型
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND (
    (table_name = 'score_types' AND column_name = 'id') OR
    (table_name = 'scores' AND column_name = 'score_type_id')
)
ORDER BY table_name, column_name;

-- 检查scores表中是否有无效的score_type_id值
SELECT 
    s.id as score_id,
    s.score_type_id,
    st.id as valid_score_type_id,
    st.name as score_type_name
FROM scores s
LEFT JOIN score_types st ON s.score_type_id = st.id
WHERE st.id IS NULL
LIMIT 10;

-- 检查是否存在score_type_id为'1'的记录
SELECT COUNT(*) as invalid_records
FROM scores 
WHERE score_type_id = '1';

-- 如果存在无效记录，显示详细信息
SELECT 
    id,
    user_id,
    score_type_id,
    score,
    reason,
    period,
    created_at
FROM scores 
WHERE score_type_id = '1'
LIMIT 5;

-- 显示所有有效的score_type_id值
SELECT id, name, category FROM score_types ORDER BY category, name;