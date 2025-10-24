-- 创建演示用户账户
-- 为登录页面提供的演示账户创建对应的数据库记录

-- 首先获取默认部门ID（如果存在的话）
DO $$
DECLARE
    default_dept_id UUID;
BEGIN
    -- 尝试获取第一个部门的ID，如果没有部门则使用NULL
    SELECT id INTO default_dept_id FROM departments LIMIT 1;
    
    -- 创建系统管理员演示账户
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@company.com') THEN
        INSERT INTO users (
            id,
            email,
            name,
            role,
            position,
            department_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'admin@company.com',
            '系统管理员',
            'admin',
            '系统管理员',
            default_dept_id,
            NOW(),
            NOW()
        );
        RAISE NOTICE '系统管理员演示账户已创建: admin@company.com';
    END IF;
    
    -- 创建考核办管理员演示账户
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'manager@company.com') THEN
        INSERT INTO users (
            id,
            email,
            name,
            role,
            position,
            department_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'manager@company.com',
            '考核办管理员',
            'manager',
            '考核办主任',
            default_dept_id,
            NOW(),
            NOW()
        );
        RAISE NOTICE '考核办管理员演示账户已创建: manager@company.com';
    END IF;
    
    -- 创建普通员工演示账户
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'employee@company.com') THEN
        INSERT INTO users (
            id,
            email,
            name,
            role,
            position,
            department_id,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'employee@company.com',
            '张三',
            'employee',
            '普通职工',
            default_dept_id,
            NOW(),
            NOW()
        );
        RAISE NOTICE '普通员工演示账户已创建: employee@company.com';
    END IF;
    
END $$;