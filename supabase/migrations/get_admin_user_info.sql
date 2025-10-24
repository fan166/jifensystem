-- 查询现有的管理员用户信息
-- 找出admin@example.com用户的实际UUID

SELECT 'admin@example.com用户信息:' as info;
SELECT id, email, name, role, position, created_at
FROM users 
WHERE email = 'admin@example.com';

-- 如果没有找到，查看所有管理员用户
SELECT '所有管理员用户:' as info;
SELECT id, email, name, role, position, created_at
FROM users 
WHERE role = 'admin'
ORDER BY created_at;

-- 查看所有用户（限制10条）
SELECT '所有用户列表:' as info;
SELECT id, email, name, role, position, created_at
FROM users 
ORDER BY created_at
LIMIT 10;