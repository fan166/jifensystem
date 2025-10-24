-- 调试score_type_id的UUID格式错误问题
-- 检查实际数据中是否存在问题

-- 1. 检查score_types表中的所有ID值
SELECT 'score_types表ID值:' as info;
SELECT id, name, category FROM score_types ORDER BY id;

-- 2. 检查scores表中的score_type_id值
SELECT 'scores表中的score_type_id值:' as info;
SELECT DISTINCT score_type_id FROM scores ORDER BY score_type_id;

-- 3. 检查是否存在无效的score_type_id（不在score_types表中的）
SELECT 'scores表中无效的score_type_id:' as info;
SELECT s.id, s.score_type_id, s.user_id, s.score, s.created_at
FROM scores s
LEFT JOIN score_types st ON s.score_type_id = st.id
WHERE st.id IS NULL;

-- 4. 检查是否有score_type_id为'1'的记录
SELECT 'score_type_id为1的记录:' as info;
SELECT COUNT(*) as count_with_id_1 FROM scores WHERE score_type_id = '1';

-- 5. 如果存在，显示这些记录的详细信息
SELECT s.id, s.user_id, s.score_type_id, s.score, s.reason, s.period, s.created_at
FROM scores s
WHERE s.score_type_id = '1'
LIMIT 5;

-- 6. 检查users表中是否有ID为'1'的用户（可能是混淆了user_id和score_type_id）
SELECT 'users表中ID为1的用户:' as info;
SELECT COUNT(*) as count_user_id_1 FROM users WHERE id = '1';

-- 7. 显示最近创建的scores记录，检查数据格式
SELECT '最近的scores记录:' as info;
SELECT s.id, s.user_id, s.score_type_id, s.score, s.created_at,
       u.name as user_name, st.name as score_type_name
FROM scores s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN score_types st ON s.score_type_id = st.id
ORDER BY s.created_at DESC
LIMIT 10;