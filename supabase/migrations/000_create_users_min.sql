-- Minimal users table to satisfy FKs and policies
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    department_id UUID,
    role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('admin','manager','employee')),
    roles TEXT[] DEFAULT ARRAY['employee']
);