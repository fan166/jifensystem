-- 调试用户数据查询
-- 检查用户姓名中是否存在特殊字符或空格问题

SELECT 
  id,
  name,
  LENGTH(name) as name_length,
  ASCII(SUBSTRING(name, 1, 1)) as first_char_ascii,
  ASCII(SUBSTRING(name, LENGTH(name), 1)) as last_char_ascii,
  CASE 
    WHEN name LIKE '% %' THEN '包含空格'
    WHEN name != TRIM(name) THEN '包含前后空格'
    ELSE '正常'
  END as name_status,
  department_id,
  created_at
FROM users 
WHERE name IN ('林木', '朱振斌', '李清超')
ORDER BY name;

-- 同时检查所有用户的姓名情况
SELECT 
  name,
  LENGTH(name) as name_length,
  CASE 
    WHEN name LIKE '% %' THEN '包含空格'
    WHEN name != TRIM(name) THEN '包含前后空格'
    ELSE '正常'
  END as name_status
FROM users 
ORDER BY name;