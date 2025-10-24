-- 为departments表添加is_active字段
ALTER TABLE departments ADD COLUMN is_active BOOLEAN DEFAULT true;

-- 更新现有记录为活跃状态
UPDATE departments SET is_active = true WHERE is_active IS NULL;

-- 添加注释
COMMENT ON COLUMN departments.is_active IS '部门是否活跃状态';