import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface PermissionSetting {
  id?: string;
  setting_key: string;
  is_enabled: boolean;
  target_roles: string[];
  description?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export const PermissionSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [canManagePermissions, setCanManagePermissions] = useState(false);
  const [dailyEnabled, setDailyEnabled] = useState<boolean>(false);
  const [annualEnabled, setAnnualEnabled] = useState<boolean>(false);
  const [records, setRecords] = useState<Record<string, PermissionSetting>>({});

  useEffect(() => {
    checkPermissions();
    fetchSettings();
  }, []);

  const checkPermissions = async () => {
    const { user } = useAuthStore.getState();
    const canManage = user?.role === 'system_admin' || user?.role === 'assessment_admin';
    setCanManagePermissions(canManage);
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('permission_settings')
        .select('*')
        .in('setting_key', ['daily_evaluation_visible', 'annual_evaluation_visible']);

      if (error) throw error;

      const map: Record<string, PermissionSetting> = {};
      (data || []).forEach((row: any) => {
        map[row.setting_key] = row as PermissionSetting;
      });
      setRecords(map);
      setDailyEnabled(Boolean(map['daily_evaluation_visible']?.is_enabled));
      setAnnualEnabled(Boolean(map['annual_evaluation_visible']?.is_enabled));
    } catch (error) {
      console.error('获取权限设置失败:', error);
      // 缺表降级：提供只读的默认状态，并提示管理员需要执行数据库迁移
      const fallback: Record<string, PermissionSetting> = {
        daily_evaluation_visible: {
          setting_key: 'daily_evaluation_visible',
          is_enabled: false,
          target_roles: ['employee'],
          description: '普通用户日常实绩评价界面可见性（缺表降级：默认禁用）'
        },
        annual_evaluation_visible: {
          setting_key: 'annual_evaluation_visible',
          is_enabled: false,
          target_roles: ['employee'],
          description: '普通用户年终集体测评界面可见性（缺表降级：默认禁用）'
        }
      };
      setRecords(fallback);
      setDailyEnabled(false);
      setAnnualEnabled(false);
      toast.warning('权限设置表缺失或不可用，已使用默认禁用。请执行数据库迁移创建 permission_settings 表。');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (setting_key: 'daily_evaluation_visible' | 'annual_evaluation_visible', is_enabled: boolean) => {
    if (!canManagePermissions) {
      toast.error('您没有权限修改权限设置');
      return;
    }
    setSavingKey(setting_key);
    const { user } = useAuthStore.getState();
    try {
      const existing = records[setting_key];
      if (existing && existing.id) {
        const { error } = await supabase
          .from('permission_settings')
          .update({ is_enabled, target_roles: ['employee'], updated_at: new Date().toISOString(), created_by: user?.id || '' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('permission_settings')
          .insert({ setting_key, is_enabled, target_roles: ['employee'], description: setting_key === 'daily_evaluation_visible' ? '普通用户日常实绩评价界面可见性' : '普通用户年终集体测评界面可见性', created_by: user?.id || '' });
        if (error) throw error;
      }
      const newRecords = { ...records, [setting_key]: { ...(records[setting_key] || {}), setting_key, is_enabled, target_roles: ['employee'] } } as Record<string, PermissionSetting>;
      setRecords(newRecords);
      toast.success('权限设置已更新');
    } catch (error) {
      console.error('更新权限设置失败:', error);
      // 如果后端缺表，提示管理员执行迁移
      toast.error('更新权限设置失败。请检查数据库是否已创建 permission_settings 表并配置RLS策略。');
    } finally {
      setSavingKey(null);
    }
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
          <p className="text-gray-600">仅系统管理员和考核办管理员可管理权限设置</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">普通员工-日常实绩评价可见性</CardTitle>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
              dailyEnabled ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-gray-50 border-gray-200'
            } ${savingKey === 'daily_evaluation_visible' ? 'opacity-60' : ''}`}>
              <Switch
                checked={dailyEnabled}
                onCheckedChange={(checked) => { setDailyEnabled(checked); saveSetting('daily_evaluation_visible', checked); }}
                disabled={savingKey === 'daily_evaluation_visible'}
                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 scale-125"
              />
              <span className={`text-sm font-medium transition-colors ${dailyEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                {dailyEnabled ? '已启用' : '已禁用'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-gray-500">仅系统管理员/考核办管理员可修改此设置</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">普通员工-年终集体测评可见性</CardTitle>
            <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all duration-200 ${
              annualEnabled ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-gray-50 border-gray-200'
            } ${savingKey === 'annual_evaluation_visible' ? 'opacity-60' : ''}`}>
              <Switch
                checked={annualEnabled}
                onCheckedChange={(checked) => { setAnnualEnabled(checked); saveSetting('annual_evaluation_visible', checked); }}
                disabled={savingKey === 'annual_evaluation_visible'}
                className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300 scale-125"
              />
              <span className={`text-sm font-medium transition-colors ${annualEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                {annualEnabled ? '已启用' : '已禁用'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-gray-500">仅系统管理员/考核办管理员可修改此设置</div>
        </CardContent>
      </Card>
    </div>
  );
};