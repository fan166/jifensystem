-- 测试新的工作实绩积分系统
-- 插入测试数据验证评分体系功能

-- 插入测试用户数据
INSERT INTO users (id, name, role) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', '测试用户1', 'employee'),
  ('550e8400-e29b-41d4-a716-446655440002', '测试用户2', 'leader'),
  ('550e8400-e29b-41d4-a716-446655440003', '测试评价员', 'assessment_admin')
ON CONFLICT (id) DO NOTHING;

-- 2. 插入测试工作任务
INSERT INTO work_tasks (id, user_id, task_title, task_description, status, created_at)
VALUES 
  ('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '测试任务1', '完成系统功能开发', 'completed', '2024-01-15 10:00:00'),
  ('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '测试任务2', '编写技术文档', 'completed', '2024-01-20 14:00:00'),
  ('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '测试任务3', '代码审查工作', 'completed', '2024-01-25 09:00:00')
ON CONFLICT (id) DO NOTHING;

-- 3. 插入工作任务详细评价（新的评分体系：工作任务量0-30分 + 工作完成质效0-20分）
INSERT INTO work_task_detailed_evaluations (
  id, task_id, evaluator_id, task_volume_score, task_volume_comments, 
  task_quality_score, task_quality_comments, evaluation_date, status
)
VALUES 
  ('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 
   25.0, '任务量较大，完成度高', 18.0, '质量优秀，符合要求', '2024-01-16', 'approved'),
  ('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 
   20.0, '任务量适中', 16.0, '质量良好', '2024-01-21', 'approved'),
  ('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 
   28.0, '任务量很大，超额完成', 19.0, '质量卓越', '2024-01-26', 'approved')
ON CONFLICT (id) DO NOTHING;

-- 4. 插入年终集体测评数据
INSERT INTO performance_evaluations (
  id, evaluator_id, evaluated_user_id, evaluation_type, score, 
  comments, evaluation_date, status, weight_factor, evaluation_round
)
VALUES 
  ('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 
   'annual', 85.0, '工作表现优秀', '2024-12-15', 'approved', 1.0, 1),
  ('880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 
   'annual', 88.0, '综合能力强', '2024-12-16', 'approved', 1.0, 1),
  ('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 
   'annual', 82.0, '工作认真负责', '2024-12-17', 'approved', 1.0, 1)
ON CONFLICT (id) DO NOTHING;

-- 5. 测试积分计算函数
-- 更新日常实绩评价汇总
SELECT update_daily_performance_summary('550e8400-e29b-41d4-a716-446655440001', '2024-01');
SELECT update_daily_performance_summary('550e8400-e29b-41d4-a716-446655440002', '2024-01');

-- 更新年终集体测评汇总
SELECT update_annual_collective_summary('550e8400-e29b-41d4-a716-446655440001', 2024);
SELECT update_annual_collective_summary('550e8400-e29b-41d4-a716-446655440002', 2024);

-- 计算最终工作实绩积分
SELECT calculate_final_work_performance_score('550e8400-e29b-41d4-a716-446655440001', 2024);
SELECT calculate_final_work_performance_score('550e8400-e29b-41d4-a716-446655440002', 2024);

-- 批量更新所有用户最终积分和排名
SELECT batch_update_final_scores(2024);

-- 6. 查询测试结果
-- 查看日常实绩评价汇总
SELECT * FROM daily_performance_summary WHERE user_id IN (
  '550e8400-e29b-41d4-a716-446655440001', 
  '550e8400-e29b-41d4-a716-446655440002'
);

-- 查看年终集体测评汇总
SELECT * FROM annual_collective_summary WHERE user_id IN (
  '550e8400-e29b-41d4-a716-446655440001', 
  '550e8400-e29b-41d4-a716-446655440002'
);

-- 查看最终工作实绩积分（验证80%+20%权重计算）
SELECT 
  u.full_name,
  fwps.daily_score,
  fwps.daily_weighted_score,
  fwps.annual_score,
  fwps.annual_weighted_score,
  fwps.final_total_score,
  fwps.ranking
FROM final_work_performance_scores fwps
JOIN users u ON fwps.user_id = u.id
WHERE fwps.evaluation_year = 2024
ORDER BY fwps.ranking;

-- 测试用户统计信息函数
SELECT * FROM get_user_performance_stats('550e8400-e29b-41d4-a716-446655440001', 2024);
SELECT * FROM get_user_performance_stats('550e8400-e29b-41d4-a716-446655440002', 2024);