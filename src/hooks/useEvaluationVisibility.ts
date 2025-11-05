import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface EvaluationVisibility {
  dailyVisible: boolean;
  annualVisible: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useEvaluationVisibility = (): EvaluationVisibility => {
  const [dailyVisible, setDailyVisible] = useState<boolean>(false);
  const [annualVisible, setAnnualVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisibility = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('permission_settings')
        .select('setting_key,is_enabled')
        .in('setting_key', ['daily_evaluation_visible', 'annual_evaluation_visible']);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.setting_key] = !!row.is_enabled;
      });
      setDailyVisible(!!map['daily_evaluation_visible']);
      setAnnualVisible(!!map['annual_evaluation_visible']);
    } catch (e) {
      console.error('读取评价可见性失败:', e);
      setError('读取评价可见性失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisibility();

    // 订阅数据库变更，确保管理员修改后前端实时生效
    const channel = supabase
      .channel('permission_settings_visibility')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permission_settings'
        },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row || !row.setting_key) return;
          if (row.setting_key === 'daily_evaluation_visible') {
            setDailyVisible(!!row.is_enabled);
          } else if (row.setting_key === 'annual_evaluation_visible') {
            setAnnualVisible(!!row.is_enabled);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return {
    dailyVisible,
    annualVisible,
    loading,
    error,
    refresh: fetchVisibility
  };
};