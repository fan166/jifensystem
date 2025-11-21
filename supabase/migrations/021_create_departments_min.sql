-- Minimal departments table to satisfy FKs
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed minimal departments
INSERT INTO departments (name, description)
VALUES ('示例科室', '用于初始化的示例部门')
ON CONFLICT (name) DO NOTHING;