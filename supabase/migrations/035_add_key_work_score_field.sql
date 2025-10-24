-- 文件名: 035_add_key_work_score_field.sql
-- 为performance_evaluations表添加重点工作评分字段，支持新的评分体系

-- 1. 添加重点工作评分字段
ALTER TABLE performance_evaluations 
ADD COLUMN key_work_score DECIMAL(4,1) NOT NULL DEFAULT 0 
CHECK (key_work_score >= 0 AND key_work_score <= 20);

-- 2. 更新总分约束条件，从50分改为70分
ALTER TABLE performance_evaluations 
DROP CONSTRAINT IF EXISTS performance_evaluations_total_score_check;

ALTER TABLE performance_evaluations 
ADD CONSTRAINT performance_evaluations_total_score_check 
CHECK (total_score >= 0 AND total_score <= 70);

-- 3. 添加评价日期字段（如果不存在）
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'performance_evaluations' 
                   AND column_name = 'evaluation_date') THEN
        ALTER TABLE performance_evaluations 
        ADD COLUMN evaluation_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- 4. 添加期间字段的注释
COMMENT ON COLUMN performance_evaluations.period IS '评价期间，格式：YYYY-MM';
COMMENT ON COLUMN performance_evaluations.work_volume_score IS '工作任务量评分 (0-30分)';
COMMENT ON COLUMN performance_evaluations.work_quality_score IS '工作完成质量评分 (0-20分)';
COMMENT ON COLUMN performance_evaluations.key_work_score IS '重点工作评分 (0-20分)';
COMMENT ON COLUMN performance_evaluations.total_score IS '总分 (0-70分)';

-- 5. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluation_date 
ON performance_evaluations(evaluation_date);

CREATE INDEX IF NOT EXISTS idx_performance_evaluations_period_type 
ON performance_evaluations(period, evaluation_type);

-- 6. 更新现有记录的总分计算（如果有数据的话）
UPDATE performance_evaluations 
SET total_score = work_volume_score + work_quality_score + key_work_score
WHERE total_score != (work_volume_score + work_quality_score + key_work_score);

-- 7. 授予权限
GRANT ALL PRIVILEGES ON performance_evaluations TO authenticated;
GRANT SELECT ON performance_evaluations TO anon;