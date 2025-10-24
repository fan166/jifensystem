import React from 'react';
import { Result, Button } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore, checkPermission, getRoleDisplayName, getPermissionDescription } from '../stores/authStore';
import type { User } from '../lib/supabase';

interface PermissionWrapperProps {
  children: React.ReactNode;
  permission: 'read' | 'write' | 'admin';
  fallback?: React.ReactNode;
  showLoginPrompt?: boolean;
}

/**
 * 权限控制包装组件
 * 根据用户权限决定是否显示子组件
 */
const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  children,
  permission,
  fallback,
  showLoginPrompt = true
}) => {
  const { user, isAuthenticated } = useAuthStore();

  // 未登录状态
  if (!isAuthenticated || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showLoginPrompt) {
      return (
        <Result
          icon={<UserOutlined />}
          title="需要登录"
          subTitle="请先登录以访问此功能"
          extra={
            <Button type="primary" onClick={() => window.location.href = '/login'}>
              去登录
            </Button>
          }
        />
      );
    }

    return null;
  }

  // 权限检查
  const hasPermission = checkPermission(user, permission);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Result
        icon={<LockOutlined />}
        title="权限不足"
        subTitle={`您当前的角色是${getRoleDisplayName(user.role)}，需要${getPermissionDescription(permission)}才能访问此功能`}
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            返回上一页
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};

export default PermissionWrapper;

/**
 * 权限检查Hook
 * 用于在组件内部检查权限
 */
export const usePermission = () => {
  const { user, isAuthenticated, hasPermission } = useAuthStore();

  return {
    user,
    isAuthenticated,
    hasPermission,
    canRead: hasPermission('read'),
    canWrite: hasPermission('write'),
    canAdmin: hasPermission('admin'),
    isSystemAdmin: user?.role === 'system_admin',
    isAssessmentAdmin: user?.role === 'assessment_admin',
    isEmployee: user?.role === 'employee'
  };
};

/**
 * 条件渲染组件
 * 根据权限条件决定是否渲染子组件
 */
interface ConditionalRenderProps {
  children: React.ReactNode;
  condition: boolean;
  fallback?: React.ReactNode;
}

export const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  children,
  condition,
  fallback = null
}) => {
  return condition ? <>{children}</> : <>{fallback}</>;
};

/**
 * 角色基础的条件渲染组件
 */
interface RoleBasedRenderProps {
  children: React.ReactNode;
  allowedRoles: ('system_admin' | 'assessment_admin' | 'employee')[];
  fallback?: React.ReactNode;
}

export const RoleBasedRender: React.FC<RoleBasedRenderProps> = ({
  children,
  allowedRoles,
  fallback = null
}) => {
  const { user } = usePermission();
  const hasRole = user && allowedRoles.includes(user.role as any);
  
  return hasRole ? <>{children}</> : <>{fallback}</>;
};

/**
 * 权限基础的条件渲染组件
 */
interface PermissionBasedRenderProps {
  children: React.ReactNode;
  permission: 'read' | 'write' | 'admin';
  fallback?: React.ReactNode;
}

export const PermissionBasedRender: React.FC<PermissionBasedRenderProps> = ({
  children,
  permission,
  fallback = null
}) => {
  const { hasPermission } = usePermission();
  const allowed = hasPermission(permission);
  
  return allowed ? <>{children}</> : <>{fallback}</>;
};