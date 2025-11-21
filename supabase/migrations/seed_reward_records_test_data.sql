-- 插入测试奖励记录数据
INSERT INTO public.reward_score_records (
  user_id, 
  reward_type_id, 
  title, 
  description, 
  score, 
  award_date, 
  award_period, 
  issuer_id, 
  certificate_number,
  is_public
) VALUES 
  (
    (SELECT id FROM public.users WHERE email = 'test@example.com' LIMIT 1),
    (SELECT id FROM public.reward_types WHERE name = '优秀员工' LIMIT 1),
    '月度优秀员工',
    '工作表现突出，完成任务优秀',
    10,
    CURRENT_DATE,
    '2024-11',
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1),
    'AWD-2024-001',
    true
  ),
  (
    (SELECT id FROM public.users WHERE email = 'test2@example.com' LIMIT 1),
    (SELECT id FROM public.reward_types WHERE name = '创新奖' LIMIT 1),
    '技术创新奖',
    '提出创新性解决方案，提升工作效率',
    15,
    CURRENT_DATE - INTERVAL '5 days',
    '2024-11',
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1),
    'AWD-2024-002',
    true
  );

-- 如果用户不存在，先创建测试用户
INSERT INTO public.users (email, name, department_id, role) 
SELECT 'test@example.com', '张三', (SELECT id FROM public.departments LIMIT 1), 'employee'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'test@example.com');

INSERT INTO public.users (email, name, department_id, role) 
SELECT 'test2@example.com', '李四', (SELECT id FROM public.departments LIMIT 1), 'employee'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'test2@example.com');

-- 检查插入的数据
SELECT r.*, u.name as user_name, rt.name as reward_type_name 
FROM public.reward_score_records r
JOIN public.users u ON r.user_id = u.id
JOIN public.reward_types rt ON r.reward_type_id = rt.id
WHERE r.is_public = true
ORDER BY r.award_date DESC;