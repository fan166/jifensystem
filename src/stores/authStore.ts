import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../lib/supabase';
import { userAPI } from '../services/api';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: 'read' | 'write' | 'admin') => boolean;
}

export const useAuthStore = create<AuthState>()(persist(
  (set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,

    login: async (email: string, password: string) => {
      // 禁用备用演示登录逻辑，所有认证在 Login 页面处理并受角色限制
      set({ isLoading: false });
      throw new Error('请通过登录页进行认证');
    },

    logout: () => {
      // 清除localStorage中的临时用户数据
      localStorage.removeItem('temp_user');
      
      // 清除Supabase会话
      supabase.auth.signOut().catch(error => {
        console.warn('Supabase登出失败:', error);
      });
      
      set({ 
        user: null, 
        isAuthenticated: false 
      });
    },

    setUser: (user: User | null) => {
      set({ 
        user, 
        isAuthenticated: !!user 
      });
    },

    checkAuth: async () => {
      set({ isLoading: true });
      try {
        // 禁用临时用户会话
        localStorage.removeItem('temp_user');

        // 检查Supabase认证状态
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
        if (supabaseUser && !error) {
          const userMetadata = supabaseUser.user_metadata || {};
          const userRole = userMetadata.role || 'employee';
          const roleMapping = {
            admin: 'system_admin',
            manager: 'assessment_admin',
            employee: 'employee'
          } as const;

          const mappedRole = roleMapping[userRole as keyof typeof roleMapping] || 'employee';

          const mappedUser = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: userMetadata.name || '用户',
            role: mappedRole,
            created_at: supabaseUser.created_at,
            updated_at: supabaseUser.updated_at || supabaseUser.created_at
          };

          set({ user: mappedUser as any, isAuthenticated: true, isLoading: false });
          return;
        }

        set({ user: null, isAuthenticated: false, isLoading: false });
      } catch (error) {
        console.error('检查认证状态失败:', error);
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },

    hasPermission: (permission: 'read' | 'write' | 'admin') => {
      const { user } = get();
      if (!user) return false;

      switch (permission) {
        case 'read':
          // 所有用户都有读权限
          return true;
        case 'write':
          // 系统管理员和考核办管理员有写权限
          return user.role === 'system_admin' || user.role === 'assessment_admin';
        case 'admin':
          // 只有系统管理员有完全管理权限
          return user.role === 'system_admin';
        default:
          return false;
      }
    }
  }),
  {
    name: 'auth-storage',
    partialize: (state) => ({ 
      user: state.user, 
      isAuthenticated: state.isAuthenticated 
    })
  }
));

// 权限检查工具函数
export const checkPermission = (user: User | null, permission: 'read' | 'write' | 'admin'): boolean => {
  if (!user) return false;

  switch (permission) {
    case 'read':
      return true;
    case 'write':
      return user.role === 'system_admin' || user.role === 'assessment_admin';
    case 'admin':
      return user.role === 'system_admin';
    default:
      return false;
  }
};

// 角色显示名称映射
export const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    system_admin: '系统管理员',
    assessment_admin: '考核办管理员',
    employee: '普通职工'
  };
  return roleMap[role] || role;
};

// 权限描述映射
export const getPermissionDescription = (permission: 'read' | 'write' | 'admin'): string => {
  const permissionMap: Record<string, string> = {
    read: '查看权限',
    write: '编辑权限',
    admin: '管理权限'
  };
  return permissionMap[permission] || permission;
};
