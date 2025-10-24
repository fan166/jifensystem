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
      set({ isLoading: true });
      try {
        // 这个方法现在主要用于状态管理，实际认证在Login组件中处理
        // 保留原有逻辑作为备用方案
        const demoAccounts = {
          'admin@company.com': 'admin123',
          'manager@company.com': 'manager123', 
          'employee@company.com': 'employee123'
        };

        if (demoAccounts[email as keyof typeof demoAccounts] !== password) {
          throw new Error('用户名或密码错误');
        }

        const users = await userAPI.getUsers();
        const user = users.find(u => u.email === email);
        
        if (user) {
          const roleMapping = {
            'admin': 'system_admin',
            'manager': 'assessment_admin',
            'employee': 'employee'
          };
          
          const mappedUser = {
            ...user,
            role: roleMapping[user.role as keyof typeof roleMapping] || user.role
          } as User;

          set({ 
            user: mappedUser, 
            isAuthenticated: true, 
            isLoading: false 
          });
        } else {
          throw new Error('用户不存在');
        }
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
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
        // 首先检查localStorage中的临时用户
        const tempUser = localStorage.getItem('temp_user');
        if (tempUser) {
          try {
            const userData = JSON.parse(tempUser);
            const user = {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            set({ 
              user, 
              isAuthenticated: true, 
              isLoading: false 
            });
            return;
          } catch (parseError) {
            console.error('解析临时用户数据失败:', parseError);
            localStorage.removeItem('temp_user');
          }
        }

        // 检查Supabase认证状态
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
        if (supabaseUser && !error) {
          const userMetadata = supabaseUser.user_metadata || {};
          const userRole = userMetadata.role || 'employee';
          
          // 角色映射
          const roleMapping = {
            'admin': 'system_admin',
            'manager': 'assessment_admin',
            'employee': 'employee'
          };

          const mappedUser = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: userMetadata.name || '用户',
            role: roleMapping[userRole as keyof typeof roleMapping] || 'employee',
            created_at: supabaseUser.created_at,
            updated_at: supabaseUser.updated_at || supabaseUser.created_at
          };

          set({ 
            user: mappedUser, 
            isAuthenticated: true, 
            isLoading: false 
          });
          return;
        }

        // 检查Zustand持久化存储中的用户
        const currentUser = get().user;
        if (currentUser) {
          // 验证用户是否仍然有效
          try {
            const users = await userAPI.getUsers();
            const validUser = users.find(u => u.id === currentUser.id);
            if (validUser) {
              set({ 
                user: validUser, 
                isAuthenticated: true, 
                isLoading: false 
              });
              return;
            }
          } catch (apiError) {
            console.warn('验证用户有效性失败，但保持当前用户状态:', apiError);
            set({ 
              user: currentUser, 
              isAuthenticated: true, 
              isLoading: false 
            });
            return;
          }
        }

        // 如果没有找到任何有效的认证状态
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
      } catch (error) {
        console.error('检查认证状态失败:', error);
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
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