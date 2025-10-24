-- 文件名: 029_extend_final_performance_scores.sql
-- 扩展最终积分表，添加更详细的计算信息和历史记录

-- 添加新字段
ALTER TABLE final_performance_scores
ADD COLUMN IF NOT EXISTS calculation_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS daily_evaluation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_evaluation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_period ON final_performance_scores(period);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_final ON final_performance_scores(is_final);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_calculated ON final_performance_scores(last_calculated_at);
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_approved ON final_performance_scores(approved_by);

-- 创建计算详情的GIN索引，用于JSON查询
CREATE INDEX IF NOT EXISTS idx_final_performance_scores_details ON final_performance_scores USING GIN (calculation_details);

-- 更新现有约束
ALTER TABLE final_performance_scores
DROP CONSTRAINT IF EXISTS final_performance_scores_user_id_period_key;

ALTER TABLE final_performance_scores
ADD CONSTRAINT final_performance_scores_user_period_unique 
UNIQUE (user_id, period);