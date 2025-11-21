import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useAuthStore } from '../stores/authStore';

export interface PermissionCheckResult {
  hasPermission: boolean;
  loading: boolean;
  error: string | null;
}

// 单个权限检查Hook（需要权限键参数）
export const usePermissionCheck = (permissionKey: string): PermissionCheckResult => {
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setHasPermission(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // 调用数据库函数检查权限
        const { data, error: rpcError } = await supabase
          .rpc('check_user_permission', {
            p_user_id: user.id,
            p_permission_key: permissionKey
          });

        if (rpcError) {
          throw rpcError;
        }

        setHasPermission(data || false);
      } catch (err) {
        console.error('权限检查失败:', err);
        setError(err instanceof Error ? err.message : '权限检查失败');
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [user, permissionKey]);

  return { hasPermission, loading, error };
};

export const useDynamicPermissionCheck = (permissionName: string) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (!isAuthenticated || !user) {
          setHasPermission(false);
          return;
        }

        // 使用本地权限检查逻辑而不是Supabase RPC
        let hasAccess = false;
        
        // 根据权限名称和用户角色判断权限
        switch (permissionName) {
          case 'view_daily_evaluation':
          case 'view_annual_evaluation':
            // 所有登录用户都可以查看评价表
            hasAccess = true;
            break;
          case 'create_daily_evaluation':
          case 'create_annual_evaluation':
            // 所有登录用户都可以创建评价
            hasAccess = true;
            break;
          case 'edit_daily_evaluation':
          case 'edit_annual_evaluation':
            // 管理员和考核办管理员可以编辑
            hasAccess = user.role === 'system_admin' || user.role === 'assessment_admin';
            break;
          case 'manage_permissions':
            // 管理员和考核办管理员可以管理权限
            hasAccess = user.role === 'system_admin' || user.role === 'assessment_admin';
            break;
          case 'approve_daily_evaluation':
          case 'approve_annual_evaluation':
            // 管理员和考核办管理员可以审批
            hasAccess = user.role === 'system_admin' || user.role === 'assessment_admin';
            break;
          case 'view_final_scores':
            // 所有登录用户都可以查看最终积分（管理员查看全部，普通职工查看自己的）
            hasAccess = true;
            break;
          case 'calculate_final_scores':
          case 'export_final_scores':
            // 管理员和考核办管理员可以计算和导出积分
            hasAccess = user.role === 'system_admin' || user.role === 'assessment_admin';
            break;
          default:
            // 默认权限检查
            hasAccess = user.role === 'system_admin';
            break;
        }
        
        setHasPermission(hasAccess);
      } catch (err) {
        console.error('权限检查异常:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [permissionName, user, isAuthenticated]);

  return { hasPermission, loading, error };
};

// 权限常量
export const PERMISSIONS = {
  // 普通用户权限
  USER_CAN_EVALUATE_OTHERS: 'user_can_evaluate_others',
  USER_CAN_VIEW_OWN_SCORES: 'user_can_view_own_scores',
  USER_CAN_VIEW_EVALUATION_HISTORY: 'user_can_view_evaluation_history',
  USER_CAN_EXPORT_PERSONAL_DATA: 'user_can_export_personal_data',
  USER_CAN_VIEW_RANKING: 'user_can_view_ranking'
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// 批量权限检查Hook
export const useMultiplePermissions = (permissionKeys: string[]) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const checkMultiplePermissions = async () => {
      if (!user || permissionKeys.length === 0) {
        setPermissions({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const permissionResults: Record<string, boolean> = {};

        // 并行检查所有权限
        const promises = permissionKeys.map(async (key) => {
          const { data, error: rpcError } = await supabase
            .rpc('check_user_permission', {
              p_user_id: user.id,
              p_permission_key: key
            });

          if (rpcError) {
            throw rpcError;
          }

          return { key, hasPermission: data || false };
        });

        const results = await Promise.all(promises);
        results.forEach(({ key, hasPermission }) => {
          permissionResults[key] = hasPermission;
        });

        setPermissions(permissionResults);
      } catch (err) {
        console.error('批量权限检查失败:', err);
        setError(err instanceof Error ? err.message : '批量权限检查失败');
        // 设置所有权限为false
        const defaultPermissions: Record<string, boolean> = {};
        permissionKeys.forEach(key => {
          defaultPermissions[key] = false;
        });
        setPermissions(defaultPermissions);
      } finally {
        setLoading(false);
      }
    };

    checkMultiplePermissions();
  }, [user, JSON.stringify(permissionKeys)]);

  return { permissions, loading, error };
};

// 角色检查Hook
export const useRoleCheck = () => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      setError('用户未登录');
    } else {
      setError(null);
    }
  }, [isAuthenticated, isLoading]);

  // 辅助函数
  const isAdmin = user?.role === 'system_admin';
  const isAssessmentAdmin = user?.role === 'assessment_admin';
  const isEmployee = user?.role === 'employee';
  const isLeader = user?.role === 'leader';
  const canCreate = isAdmin || isAssessmentAdmin;
  const canEdit = isAdmin || isAssessmentAdmin;
  const canApprove = isAdmin || isAssessmentAdmin || isLeader;

  return {
    user,
    userRole: user?.role || null,
    loading: isLoading,
    error,
    isAdmin,
    isAssessmentAdmin,
    isEmployee,
    isLeader,
    canCreate,
    canEdit,
    canApprove
  };
};