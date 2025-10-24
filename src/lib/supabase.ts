import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库表类型定义
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'system_admin' | 'assessment_admin' | 'employee';
  department_id?: string;
  position?: string;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ScoreType {
  id: string;
  name: string;
  description?: string;
  category: 'basic_duty' | 'work_performance' | 'key_work' | 'performance_bonus';
  max_score?: number;
  min_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Score {
  id: string;
  user_id: string;
  score_type_id: string;
  score: number;
  reason: string;
  recorder_id: string;
  period: string; // 考核周期，如 '2024-01'
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  evaluator_id: string;
  period: string;
  total_score: number;
  rank?: number;
  comments?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface Reward {
  id: string;
  user_id: string;
  type: 'promotion' | 'bonus' | 'recognition' | 'training';
  title: string;
  description?: string;
  amount?: number;
  period: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'distributed';
  created_at: string;
  updated_at: string;
}