import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Loader2, Settings, Shield, Users } from 'lucide-react';
import { useDynamicPermissionCheck } from '../hooks/usePermissionCheck';
import { useAuthStore } from '../stores/authStore';

interface PermissionSetting {
  id: string;
  setting_key: string;
  is_enabled: boolean;
  target_roles: string[];
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  'system_admin': '系统管理员',
  'assessment_admin': '考核办管理员',
  'department_leader': '部门领导',
  'employee': '普通职工'
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'view_daily_evaluation': '查看日常实绩评价',
  'create_daily_evaluation': '创建日常实绩评价',
  'view_annual_evaluation': '查看年终集体测评',
  'create_annual_evaluation': '创建年终集体测评',
  'view_final_scores': '查看最终积分统计',
  'view_personal_scores': '查看个人积分',
  'manage_evaluation_batches': '管理评价批次',
  'approve_evaluations': '审批评价结果'
};

export const PermissionSettings: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { hasPermission } = useDynamicPermissionCheck();
  const [canManagePermissions, setCanManagePermissions] = useState(false);

  useEffect(() => {
    checkPermissions();
    fetchPermissions();
  }, []);

  const checkPermissions = async () => {
    // 直接检查用户角色，确保管理员拥有完全权限
    const { user } = useAuthStore.getState();
    const canManage = user?.role === 'system_admin' || user?.role === 'assessment_admin';
    setCanManagePermissions(canManage);
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permission_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('获取权限设置失败:', error);
      toast.error('获取权限设置失败');
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (id: string, updates: Partial<PermissionSetting>) => {
    if (!canManagePermissions) {
      toast.error('您没有权限修改权限设置');
      return;
    }

    setSaving(id);
    try {
      const { error } = await supabase
        .from('permission_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setPermissions(prev => 
        prev.map(p => p.id === id ? { ...p, ...updates } : p)
      );
      toast.success('权限设置已更新');
    } catch (error) {
      console.error('更新权限设置失败:', error);
      toast.error('更新权限设置失败');
    } finally {
      setSaving(null);
    }
  };

  const togglePermission = (id: string, currentEnabled: boolean) => {
    updatePermission(id, { is_enabled: !currentEnabled });
  };

  const updateDescription = (id: string, description: string) => {
    updatePermission(id, { description });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载权限设置中...</span>
      </div>
    );
  }

  if (!canManagePermissions) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">权限不足</h3>
          <p className="text-gray-600">您没有权限访问权限设置功能</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <h2 className="text-xl font-semibold">权限设置</h2>
      </div>

      <div className="grid gap-4">
        {permissions.map((permission) => (
          <Card key={permission.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {PERMISSION_DESCRIPTIONS[permission.setting_key] || permission.setting_key}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
                    permission.is_enabled 
                      ? 'bg-green-50 border-green-200 shadow-sm' 
                      : 'bg-gray-50 border-gray-200'
                  } ${saving === permission.id ? 'opacity-60' : ''}`}>
                    <Switch
                      checked={permission.is_enabled}
                      onCheckedChange={() => togglePermission(permission.id, permission.is_enabled)}
                      disabled={saving === permission.id}
                      className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 scale-125"
                    />
                    <span className={`text-sm font-medium transition-colors ${
                      permission.is_enabled 
                        ? 'text-green-700' 
                        : 'text-gray-500'
                    }`}>
                      {permission.is_enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  {saving === permission.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  适用角色
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {permission.target_roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {ROLE_LABELS[role] || role}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label htmlFor={`desc-${permission.id}`} className="text-sm font-medium">
                  权限描述
                </Label>
                <Textarea
                  id={`desc-${permission.id}`}
                  value={permission.description}
                  onChange={(e) => {
                    setPermissions(prev => 
                      prev.map(p => p.id === permission.id ? { ...p, description: e.target.value } : p)
                    );
                  }}
                  onBlur={(e) => {
                    if (e.target.value !== permission.description) {
                      updateDescription(permission.id, e.target.value);
                    }
                  }}
                  placeholder="输入权限描述..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="text-xs text-gray-500">
                <p>权限键: {permission.setting_key}</p>
                <p>最后更新: {new Date(permission.updated_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {permissions.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">暂无权限设置</h3>
            <p className="text-gray-600">系统中还没有配置任何权限设置</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};