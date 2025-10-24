-- 修复表权限问题
-- 为anon和authenticated角色授予基本表权限

-- 授予anon角色基本读取权限
GRANT SELECT ON users TO anon;
GRANT SELECT ON departments TO anon;
GRANT SELECT ON score_types TO anon;
GRANT SELECT ON scores TO anon;
GRANT SELECT ON evaluations TO anon;
GRANT SELECT ON rewards TO anon;

-- 授予authenticated角色完整权限
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT ALL PRIVILEGES ON departments TO authenticated;
GRANT ALL PRIVILEGES ON score_types TO authenticated;
GRANT ALL PRIVILEGES ON scores TO authenticated;
GRANT ALL PRIVILEGES ON evaluations TO authenticated;
GRANT ALL PRIVILEGES ON rewards TO authenticated;

-- 授予序列权限（如果有的话）
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 确保函数权限
GRANT EXECUTE ON FUNCTION get_user_score_summary(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_score_ranking(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_score_summary(UUID, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_score_ranking(VARCHAR) TO anon;

-- 添加更详细的错误日志记录
CREATE OR REPLACE FUNCTION log_score_import_error(
    error_message TEXT,
    user_data JSONB DEFAULT NULL,
    context TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- 这里可以记录到日志表或者输出调试信息
    RAISE NOTICE 'Score Import Error: % | User Data: % | Context: %', error_message, user_data, context;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION log_score_import_error(TEXT, JSONB, TEXT) TO authenticated;