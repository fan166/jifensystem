-- 创建认证用户脚本
-- 这个脚本将在auth.users表中创建演示用户

-- 插入演示用户到auth.users表
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  aud,
  role
) VALUES 
(
  gen_random_uuid(),
  'admin@company.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"name": "系统管理员", "role": "admin"}',
  'authenticated',
  'authenticated'
),
(
  gen_random_uuid(),
  'manager@company.com',
  crypt('manager123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"name": "考核办管理员", "role": "manager"}',
  'authenticated',
  'authenticated'
),
(
  gen_random_uuid(),
  'employee@company.com',
  crypt('employee123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"name": "普通员工", "role": "employee"}',
  'authenticated',
  'authenticated'
);

-- 验证插入结果
SELECT id, email, email_confirmed_at, raw_user_meta_data FROM auth.users 
WHERE email IN ('admin@company.com', 'manager@company.com', 'employee@company.com');