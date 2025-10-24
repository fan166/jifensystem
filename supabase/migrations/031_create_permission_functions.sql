-- 文件名: 031_create_permission_functions.sql
-- 创建权限检查相关的函数

-- 删除现有函数（如果存在）
DROP FUNCTION IF EXISTS check_user_permission(UUID, VARCHAR);
DROP FUNCTION IF EXISTS get_user_accessible_batches(UUID);

-- 检查用户是否有特定权限的函数
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_permission_key VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR(50);
    permission_enabled BOOLEAN := false;
BEGIN
    -- 获取用户角色
    SELECT role INTO user_role
    FROM users
    WHERE id = p_user_id;
    
    -- 管理员和考核办管理员拥有所有权限
    IF user_role IN ('system_admin', 'assessment_admin') THEN
        RETURN true;
    END IF;
    
    -- 检查特定权限设置
    SELECT is_enabled INTO permission_enabled
    FROM permission_settings
    WHERE setting_key = p_permission_key;
    
    -- 如果权限设置不存在，默认为false
    RETURN COALESCE(permission_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- 获取用户可访问的评价批次
CREATE OR REPLACE FUNCTION get_user_accessible_batches(
    p_user_id UUID
) RETURNS TABLE(
    batch_id UUID,
    batch_name VARCHAR(200),
    evaluation_type VARCHAR(20),
    period VARCHAR(20),
    status VARCHAR(20)
) AS $$
DECLARE
    user_role VARCHAR(50);
BEGIN
    -- 获取用户角色
    SELECT role INTO user_role
    FROM users
    WHERE id = p_user_id;
    
    -- 管理员可以访问所有批次
    IF user_role IN ('system_admin', 'assessment_admin', 'leader') THEN
        RETURN QUERY
        SELECT eb.id, eb.batch_name, eb.evaluation_type, eb.period, eb.status
        FROM evaluation_batches eb
        ORDER BY eb.created_at DESC;
    ELSE
        -- 普通用户只能访问相关的批次
        RETURN QUERY
        SELECT eb.id, eb.batch_name, eb.evaluation_type, eb.period, eb.status
        FROM evaluation_batches eb
        WHERE eb.status = 'active'
            AND (eb.target_users ? p_user_id::text OR eb.evaluator_users ? p_user_id::text)
        ORDER BY eb.created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;