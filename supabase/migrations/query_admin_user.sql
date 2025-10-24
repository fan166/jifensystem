-- 查询admin@example.com用户的实际UUID
DO $$
DECLARE
    admin_user_id UUID;
    admin_user_record RECORD;
BEGIN
    -- 查找admin@example.com用户
    SELECT id, email, name, role INTO admin_user_record
    FROM users 
    WHERE email = 'admin@example.com'
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Found admin user: ID=%, Email=%, Name=%, Role=%', 
            admin_user_record.id, admin_user_record.email, admin_user_record.name, admin_user_record.role;
    ELSE
        RAISE NOTICE 'No admin user found with email admin@example.com';
        
        -- 查看所有管理员用户
        FOR admin_user_record IN 
            SELECT id, email, name, role FROM users WHERE role = 'admin' ORDER BY created_at
        LOOP
            RAISE NOTICE 'Admin user found: ID=%, Email=%, Name=%, Role=%', 
                admin_user_record.id, admin_user_record.email, admin_user_record.name, admin_user_record.role;
        END LOOP;
    END IF;
END $$;