import React, { useState, useEffect } from 'react';
import {
  Card,
  Timeline,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Progress,
  Tag,
  Space,
  message,
  Upload,
  List,
  Avatar,
  Tooltip,
  Row,
  Col,
  Statistic,
  DatePicker
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface KeyWorkMilestone {
  id: string;
  key_work_id: string;
  milestone_title: string;
  milestone_description?: string;
  target_date: string;
  actual_date?: string;
  status: string;
  completion_rate: number;
  created_by: string;
  created_at: string;
  creator_name?: string;
}

interface KeyWorkProgress {
  id: string;
  key_work_id: string;
  progress_description: string;
  completion_percentage: number;
  attachments?: string[];
  reported_by: string;
  reported_at: string;
  reporter_name?: string;
}

interface KeyWorkTrackingProps {
  keyWorkId: string;
  keyWorkTitle: string;
  canEdit: boolean;
}

const KeyWorkTracking: React.FC<KeyWorkTrackingProps> = ({
  keyWorkId,
  keyWorkTitle,
  canEdit
}) => {
  const { user } = useAuthStore();
  const [milestones, setMilestones] = useState<KeyWorkMilestone[]>([]);
  const [progressReports, setProgressReports] = useState<KeyWorkProgress[]>([]);
  const [milestoneTableMissing, setMilestoneTableMissing] = useState(false);
  const [progressTableMissing, setProgressTableMissing] = useState(false);

  const localProgressKey = (kwid: string) => `kw_progress_${kwid}`;
  const loadLocalProgress = (kwid: string): KeyWorkProgress[] => {
    try {
      const raw = localStorage.getItem(localProgressKey(kwid));
      if (!raw) return [];
      const arr = JSON.parse(raw) || [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };
  const saveLocalProgress = (kwid: string, items: KeyWorkProgress[]) => {
    try {
      localStorage.setItem(localProgressKey(kwid), JSON.stringify(items));
    } catch {}
  };
  const [loading, setLoading] = useState(false);
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [milestoneForm] = Form.useForm();
  const [progressForm] = Form.useForm();
  const [editingMilestone, setEditingMilestone] = useState<KeyWorkMilestone | null>(null);

  useEffect(() => {
    fetchMilestones();
    fetchProgressReports();
  }, [keyWorkId]);

  // 获取里程碑列表
  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('key_work_milestones')
        .select(`
          *,
          creator:users!created_by(name)
        `)
        .eq('key_work_id', keyWorkId)
        .order('target_date', { ascending: true });

      if (error) {
        if ((error as any).code === 'PGRST205') {
          setMilestoneTableMissing(true);
          setMilestones([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(milestone => ({
        ...milestone,
        creator_name: milestone.creator?.name
      })) || [];

      setMilestones(formattedData);
    } catch (error) {
      console.error('获取里程碑失败:', error);
      if (!milestoneTableMissing) message.error('获取里程碑失败');
    }
  };

  // 获取进度报告列表
  const fetchProgressReports = async () => {
    try {
      const { data, error } = await supabase
        .from('key_work_progress')
        .select(`
          *,
          reporter:users!reported_by(name)
        `)
        .eq('key_work_id', keyWorkId)
        .order('reported_at', { ascending: false });

      if (error) {
        if ((error as any).code === 'PGRST205') {
          setProgressTableMissing(true);
          const local = loadLocalProgress(keyWorkId);
          setProgressReports(local);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(progress => ({
        ...progress,
        reporter_name: progress.reporter?.name
      })) || [];

      setProgressReports(formattedData);
    } catch (error) {
      console.error('获取进度报告失败:', error);
      if (!progressTableMissing) message.error('获取进度报告失败');
    }
  };

  // 创建或更新里程碑
  const handleMilestoneSubmit = async (values: any) => {
    try {
      if (milestoneTableMissing) {
        message.error('未启用里程碑数据表，无法创建里程碑');
        return;
      }
      const milestoneData = {
        key_work_id: keyWorkId,
        milestone_title: values.milestone_title,
        milestone_description: values.milestone_description,
        target_date: values.target_date.format('YYYY-MM-DD'),
        created_by: user?.id
      };

      let result;
      if (editingMilestone) {
        result = await supabase
          .from('key_work_milestones')
          .update(milestoneData)
          .eq('id', editingMilestone.id);
      } else {
        result = await supabase
          .from('key_work_milestones')
          .insert([milestoneData]);
      }

      if (result.error) throw result.error;

      message.success(editingMilestone ? '里程碑更新成功' : '里程碑创建成功');
      setMilestoneModalVisible(false);
      setEditingMilestone(null);
      milestoneForm.resetFields();
      fetchMilestones();
    } catch (error) {
      console.error('里程碑操作失败:', error);
      message.error('里程碑操作失败');
    }
  };

  // 更新里程碑状态
  const handleMilestoneStatusUpdate = async (milestoneId: string, status: string, completionRate: number) => {
    try {
      if (milestoneTableMissing) {
        message.error('未启用里程碑数据表，无法更新里程碑');
        return;
      }
      const updateData: any = { status, completion_rate: completionRate };
      if (status === 'completed') {
        updateData.actual_date = dayjs().format('YYYY-MM-DD');
      }

      const { error } = await supabase
        .from('key_work_milestones')
        .update(updateData)
        .eq('id', milestoneId);

      if (error) throw error;

      message.success('里程碑状态更新成功');
      fetchMilestones();
    } catch (error) {
      console.error('里程碑状态更新失败:', error);
      message.error('里程碑状态更新失败');
    }
  };

  // 提交进度报告
  const handleProgressSubmit = async (values: any) => {
    try {
      if (progressTableMissing) {
        const newItem: KeyWorkProgress = {
          id: `${keyWorkId}-${Date.now()}`,
          key_work_id: keyWorkId,
          progress_description: values.progress_description,
          completion_percentage: values.completion_percentage,
          attachments: [],
          reported_by: user?.id || '',
          reported_at: dayjs().toISOString(),
          reporter_name: (user as any)?.name || '我'
        } as any;
        const current = loadLocalProgress(keyWorkId);
        const updated = [newItem, ...current].sort((a, b) => dayjs(b.reported_at).valueOf() - dayjs(a.reported_at).valueOf());
        saveLocalProgress(keyWorkId, updated);
        setProgressReports(updated);
        message.success('进度报告提交成功');
        setProgressModalVisible(false);
        progressForm.resetFields();
        return;
      }
      const progressData = {
        key_work_id: keyWorkId,
        progress_description: values.progress_description,
        completion_percentage: values.completion_percentage,
        reported_by: user?.id
      };

      const { error } = await supabase
        .from('key_work_progress')
        .insert([progressData]);

      if (error) throw error;

      message.success('进度报告提交成功');
      setProgressModalVisible(false);
      progressForm.resetFields();
      fetchProgressReports();
    } catch (error) {
      console.error('进度报告提交失败:', error);
      message.error('进度报告提交失败');
    }
  };

  // 状态映射
  const statusMap = {
    pending: { text: '待开始', color: 'default' },
    in_progress: { text: '进行中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    delayed: { text: '延期', color: 'error' }
  };

  // 计算总体进度
  const calculateOverallProgress = () => {
    if (milestones.length === 0) return 0;
    const totalProgress = milestones.reduce((sum, milestone) => sum + milestone.completion_rate, 0);
    return Math.round(totalProgress / milestones.length);
  };

  return (
    <div className="space-y-6">
      


      



      
    </div>
  );
};

export default KeyWorkTracking;
