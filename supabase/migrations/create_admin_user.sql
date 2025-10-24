-- 创建系统管理员用户记录
-- 确保authStore中的模拟用户ID在数据库中存在

-- 首先检查用户是否已存在
DO $$
BEGIN
    -- 检查是否已存在该UUID的用户
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000') THEN
        -- 插入系统管理员用户
        INSERT INTO users (
            id,
            email,
            name,
            role,
            position,
            created_at,
            updated_at
        ) VALUES (
            '550e8400-e29b-41d4-a716-446655440000',
            'admin@example.com',
            '系统管理员',
            'admin',
            '系统管理员',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '系统管理员用户已创建';
    ELSE
        RAISE NOTICE '系统管理员用户已存在';
    END IF;
END $$;