import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = (): AuthState => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 获取当前用户
    const getCurrentUser = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 首先检查临时用户
        const tempUser = localStorage.getItem('temp_user');
        if (tempUser) {
          const userData = JSON.parse(tempUser);
          setUser({
            id: userData.id,
            email: userData.email,
            user_metadata: { name: userData.name, role: userData.role },
            app_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as User);
          return;
        }
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError && !tempUser) {
          // 如果没有临时用户且Supabase认证失败，不抛出错误，只是设置为null
          setUser(null);
          return;
        }
        
        setUser(user);
      } catch (err) {
        console.error('获取用户信息失败:', err);
        setError(err instanceof Error ? err.message : '获取用户信息失败');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getCurrentUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, error };
};