import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Calendar, User, Star, Edit, Trash2, Eye, Save, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDynamicPermissionCheck, useRoleCheck } from '../hooks/usePermissionCheck';

interface User {
  id: string;
  name: string;
  department: string;
  role: string;
}

interface EvaluationBatch {
  id: string;
  batch_name: string;
  evaluation_type: string;
  period: string;
  status: string;
  start_date: string;
  end_date: string;
  target_users: string[];
  evaluator_users: string[];
  description: string;
}

interface DailyEvaluation {
  id: string;
  evaluated_user_id: string;
  evaluator_id: string;
  batch_id: string | null;
  evaluation_type: string;
  work_volume_score: number; // 工作任务量分数 (30分)
  work_quality_score: number; // 工作完成质效分数 (20分)
  key_work_score: number; // 重点工作分数 (20分)
  total_score: number; // 总分 (70分)
  comments: string;
  evaluation_date: string;
  period: string;
  status: string;
  is_anonymous: boolean;
  evaluation_round: number;
  weight_factor: number;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  evaluated_user: User;
  evaluator: User;
  batch: EvaluationBatch | null;
}

// 新的评分标准 - 基于三明市公路事业发展中心绩效管理表
// 工作任务量评分标准 (30分)
const WORK_VOLUME_SCORES = [
  { value: 30, label: '超额完成', description: '超额完成工作任务，工作量大' },
  { value: 24, label: '正常完成', description: '按时完成工作任务，工作量正常' },
  { value: 18, label: '基本完成', description: '基本完成工作任务，工作量一般' },
  { value: 12, label: '部分未完成', description: '部分工作任务未完成，工作量不足' }
];

// 工作完成质效评分标准 (20分)
const WORK_QUALITY_SCORES = [
  { value: 20, label: '超额完成', description: '工作质量优秀，超出预期' },
  { value: 16, label: '正常完成', description: '工作质量良好，符合要求' },
  { value: 12, label: '基本完成', description: '工作质量一般，基本符合要求' },
  { value: 8, label: '部分未完成', description: '工作质量较差，需要改进' }
];

// 重点工作评分标准 (20分)
const KEY_WORK_SCORES = [
  { value: 20, label: '超额完成', description: '重点工作完成出色，效果显著' },
  { value: 16, label: '正常完成', description: '重点工作按时完成，效果良好' },
  { value: 12, label: '基本完成', description: '重点工作基本完成，效果一般' },
  { value: 8, label: '部分未完成', description: '重点工作完成不理想，需要加强' }
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'pending': { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  'approved': { label: '已审核', color: 'bg-green-100 text-green-800' },
  'rejected': { label: '已驳回', color: 'bg-red-100 text-red-800' }
};

const PERIOD_OPTIONS = [
  { value: '2025', label: '2025年' },
  { value: '2024', label: '2024年' },
  { value: '2023', label: '2023年' },
  { value: '2022', label: '2022年' }
];

export const DailyEvaluationTab: React.FC = () => {
  const [evaluations, setEvaluations] = useState<DailyEvaluation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<DailyEvaluation | null>(null);
  const { user } = useAuth();
  const { hasPermission } = useDynamicPermissionCheck();
  const { userRole, isAdmin, isLeader } = useRoleCheck();
  const [permissions, setPermissions] = useState({
    canView: false,
    canCreate: false,
    canEdit: false,
    canApprove: false
  });

  // 表单状态
  const [formData, setFormData] = useState({
    evaluated_user_id: '',
    work_volume_score: '',
    work_quality_score: '',
    comments: '',
    is_anonymous: false
  });

  // 批量评价状态
  const [batchEvaluationMode, setBatchEvaluationMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [batchScores, setBatchScores] = useState<Record<string, { work_volume_score: number; work_quality_score: number; comments: string }>>({});

  // 优化的事件处理函数
  const handleWorkVolumeChange = useCallback((userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: parseFloat(value) || 0,
        work_quality_score: prev[userId]?.work_quality_score || 0,
        comments: prev[userId]?.comments || ''
      }
    }));
  }, []);

  const handleWorkQualityChange = useCallback((userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: prev[userId]?.work_volume_score || 0,
        work_quality_score: parseFloat(value) || 0,
        comments: prev[userId]?.comments || ''
      }
    }));
  }, []);

  const handleCommentsChange = useCallback((userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: prev[userId]?.work_volume_score || 0,
        work_quality_score: prev[userId]?.work_quality_score || 0,
        comments: value
      }
    }));
  }, []);

  // 批量评价对话框
  const BatchEvaluationDialog = () => {
    if (!batchEvaluationMode) return null;

    return (
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批量评价</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>选择要评价的人员</Label>
            <div className="grid grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto border rounded p-2">
              {users.map(user => (
                <label key={user.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers(prev => [...prev, user.id]);
                      } else {
                        setSelectedUsers(prev => prev.filter(id => id !== user.id));
                        setBatchScores(prev => {
                          const newScores = { ...prev };
                          delete newScores[user.id];
                          return newScores;
                        });
                      }
                    }}
                    className="rounded"
                  />
                  <span>{user.name}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">为选中人员评分</h4>
              {selectedUsers.map(userId => {
                const user = users.find(u => u.id === userId);
                if (!user) return null;

                return (
                  <div key={userId} className="border rounded p-4">
                    <h5 className="font-medium mb-3">{user.name} - {user.department}</h5>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          工作任务量 (0-30分)
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">当前分数：</span>
                            <span className="text-lg font-semibold text-blue-600">{batchScores[user.id]?.work_volume_score || 0}分</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            step="1"
                            value={batchScores[user.id]?.work_volume_score || 0}
                            onInput={(e) => {
                              e.stopPropagation();
                              handleWorkVolumeChange(user.id, e.target.value);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((batchScores[user.id]?.work_volume_score || 0) / 30) * 100}%, #e5e7eb ${((batchScores[user.id]?.work_volume_score || 0) / 30) * 100}%, #e5e7eb 100%)`
                            }}
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0分</span>
                            <span>15分</span>
                            <span>30分</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          工作完成质效 (0-20分)
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">当前分数：</span>
                            <span className="text-lg font-semibold text-green-600">{batchScores[user.id]?.work_quality_score || 0}分</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={batchScores[user.id]?.work_quality_score || 0}
                            onInput={(e) => {
                              e.stopPropagation();
                              handleWorkQualityChange(user.id, e.target.value);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #10b981 0%, #10b981 ${((batchScores[user.id]?.work_quality_score || 0) / 20) * 100}%, #e5e7eb ${((batchScores[user.id]?.work_quality_score || 0) / 20) * 100}%, #e5e7eb 100%)`
                            }}
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>0分</span>
                            <span>10分</span>
                            <span>20分</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {batchScores[user.id]?.work_volume_score && batchScores[user.id]?.work_quality_score && (
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <div className="text-sm font-medium text-blue-800">
                          总分：{(batchScores[user.id]?.work_volume_score || 0) + (batchScores[user.id]?.work_quality_score || 0)}分
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        评价意见
                      </label>
                      <textarea
                        value={batchScores[user.id]?.comments || ''}
                        onChange={(e) => {
                           e.stopPropagation();
                           handleCommentsChange(user.id, e.target.value);
                         }}
                        placeholder="输入评价意见..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="batch_is_anonymous"
              checked={formData.is_anonymous}
              onChange={(e) => setFormData(prev => ({ ...prev, is_anonymous: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="batch_is_anonymous">匿名评价</Label>
          </div>



          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleBatchSubmit} 
              disabled={submitting || selectedUsers.length === 0}
              className="flex-1 border-2 border-primary rounded-md shadow-sm hover:shadow-md transition-shadow"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              提交批量评价
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setBatchEvaluationMode(false);
                setShowCreateDialog(false);
                setSelectedUsers([]);
                setBatchScores({});
              }}
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  useEffect(() => {
    checkPermissions();
    fetchUsers();
    fetchBatches();
  }, []);

  useEffect(() => {
    if (permissions.canView) {
      fetchEvaluations();
    }
  }, [permissions.canView, selectedPeriod]);

  const checkPermissions = async () => {
    // 允许所有登录用户查看和操作日常实绩评价表
    setPermissions({
      canView: true,
      canCreate: true,
      canEdit: true,
      canApprove: isAdmin || isLeader
    });
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, 
          name, 
          role,
          department:departments(name)
        `)
        .order('name');

      if (error) throw error;
      
      // 转换数据格式，将department对象转换为字符串
      const formattedUsers = (data || []).map(user => ({
        ...user,
        department: user.department?.name || '未分配部门'
      }));
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      toast.error('获取用户列表失败');
    }
  };

  const fetchBatches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('get_user_accessible_batches', { p_user_id: user.id });

      if (error) throw error;
      
      const dailyBatches = (data || []).filter(
        (batch: EvaluationBatch) => batch.evaluation_type === 'daily'
      );
      setBatches(dailyBatches);
    } catch (error) {
      console.error('获取评价批次失败:', error);
    }
  };

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      console.log('开始获取评价数据，当前用户:', user?.id, '选择期间:', selectedPeriod);
      
      // 先获取基本的评价数据，使用period字段进行筛选
      let query = supabase
        .from('performance_evaluations')
        .select('*')
        .eq('evaluation_type', 'daily')
        .eq('period', selectedPeriod)
        .order('created_at', { ascending: false });

      // 根据权限过滤数据
      if (!permissions.canApprove) {
        query = query.or(`evaluator_id.eq.${user?.id},evaluated_user_id.eq.${user?.id}`);
      }

      const { data: evaluationsData, error: evaluationsError } = await query;

      if (evaluationsError) {
        console.error('获取评价数据失败:', evaluationsError);
        throw evaluationsError;
      }

      console.log('获取到的评价数据:', evaluationsData);

      if (!evaluationsData || evaluationsData.length === 0) {
        console.log('没有找到评价数据');
        setEvaluations([]);
        setLoading(false);
        return;
      }

      // 获取所有相关用户ID
      const userIds = new Set<string>();
      evaluationsData.forEach(evaluation => {
        userIds.add(evaluation.evaluated_user_id);
        userIds.add(evaluation.evaluator_id);
      });

      // 获取用户信息
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          id, 
          name, 
          role,
          department:departments(name)
        `)
        .in('id', Array.from(userIds));

      if (usersError) {
        console.error('获取用户数据失败:', usersError);
      }

      console.log('获取到的用户数据:', usersData);

      // 创建用户映射
      const userMap = new Map();
      (usersData || []).forEach(user => {
        userMap.set(user.id, {
          ...user,
          department: user.department?.name || '未设置部门'
        });
      });

      // 组合数据
      const enrichedEvaluations = evaluationsData.map(evaluation => ({
        ...evaluation,
        evaluated_user: userMap.get(evaluation.evaluated_user_id) || {
          id: evaluation.evaluated_user_id,
          name: '未知用户',
          role: '未设置',
          department: '未设置部门'
        },
        evaluator: userMap.get(evaluation.evaluator_id) || {
          id: evaluation.evaluator_id,
          name: '未知用户',
          role: '未设置',
          department: '未设置部门'
        },
        batch: null // 暂时不处理批次信息
      }));

      console.log('最终的评价数据:', enrichedEvaluations);
      setEvaluations(enrichedEvaluations);
    } catch (error) {
      console.error('获取日常评价失败:', error);
      toast.error('获取日常评价失败');
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!user || !formData.evaluated_user_id || !formData.work_volume_score || !formData.work_quality_score) {
      toast.error('请填写必填字段');
      return;
    }

    const workVolumeScore = parseFloat(formData.work_volume_score);
    const workQualityScore = parseFloat(formData.work_quality_score);
    const totalScore = workVolumeScore + workQualityScore;

    if (workVolumeScore < 0 || workVolumeScore > 30) {
      toast.error('工作任务量分数必须在0-30之间');
      return;
    }

    if (workQualityScore < 0 || workQualityScore > 20) {
      toast.error('工作完成质效分数必须在0-20之间');
      return;
    }

    setSubmitting(true);
    try {
      const evaluationData = {
        evaluated_user_id: formData.evaluated_user_id,
        evaluator_id: user.id,
        batch_id: null,
        evaluation_type: 'daily',
        work_volume_score: workVolumeScore,
        work_quality_score: workQualityScore,
        key_work_score: 0,
        total_score: totalScore,
        comments: formData.comments,
        evaluation_date: new Date().toISOString().split('T')[0],
        period: selectedPeriod,
        status: 'pending',
        is_anonymous: formData.is_anonymous,
        evaluation_round: 1,
        weight_factor: 1.0
      };

      let result;
      if (editingEvaluation) {
        result = await supabase
          .from('performance_evaluations')
          .update({
            ...evaluationData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingEvaluation.id)
          .select();
      } else {
        result = await supabase
          .from('performance_evaluations')
          .insert([evaluationData])
          .select();
      }

      if (result.error) throw result.error;

      toast.success(editingEvaluation ? '评价更新成功' : '评价提交成功');
      setShowCreateDialog(false);
      setEditingEvaluation(null);
      resetForm();
      // 立即刷新评价记录列表
      fetchEvaluations();
    } catch (error) {
      console.error('提交评价失败:', error);
      toast.error('提交评价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (evaluation: DailyEvaluation) => {
    setEditingEvaluation(evaluation);
    setFormData({
      evaluated_user_id: evaluation.evaluated_user_id,
      batch_id: evaluation.batch_id || '',
      work_volume_score: evaluation.work_volume_score.toString(),
      work_quality_score: evaluation.work_quality_score.toString(),
      comments: evaluation.comments,
      is_anonymous: evaluation.is_anonymous
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条评价吗？')) return;

    try {
      const { error } = await supabase
        .from('performance_evaluations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('评价删除成功');
      fetchEvaluations();
    } catch (error) {
      console.error('删除评价失败:', error);
      toast.error('删除评价失败');
    }
  };

  const handleApprove = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('performance_evaluations')
        .update({
          status,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`评价${status === 'approved' ? '审核通过' : '已驳回'}`);
      fetchEvaluations();
    } catch (error) {
      console.error('审核失败:', error);
      toast.error('审核失败');
    }
  };

  const resetForm = () => {
    setFormData({
      evaluated_user_id: '',
      work_volume_score: '',
      work_quality_score: '',
      comments: '',
      is_anonymous: false
    });
  };

  // 批量评价提交
  const handleBatchSubmit = async () => {
    if (!user || selectedUsers.length === 0) {
      toast.error('请选择要评价的人员');
      return;
    }

    // 验证所有选中用户都有评分
    for (const userId of selectedUsers) {
      const scores = batchScores[userId];
      if (!scores || !scores.work_volume_score || !scores.work_quality_score) {
        const user = users.find(u => u.id === userId);
        toast.error(`请为 ${user?.name} 填写完整的评分`);
        return;
      }

      if (scores.work_volume_score < 0 || scores.work_volume_score > 30) {
        const user = users.find(u => u.id === userId);
        toast.error(`${user?.name} 的工作任务量分数必须在0-30之间`);
        return;
      }

      if (scores.work_quality_score < 0 || scores.work_quality_score > 20) {
        const user = users.find(u => u.id === userId);
        toast.error(`${user?.name} 的工作完成质效分数必须在0-20之间`);
        return;
      }

    }

    setSubmitting(true);
    try {
      const evaluations = selectedUsers.map(userId => {
        const scores = batchScores[userId];
        if (!scores) return null;
        
        return {
          evaluated_user_id: userId,
          evaluator_id: user.id,
          batch_id: null,
          evaluation_type: 'daily',
          work_volume_score: scores.work_volume_score,
          work_quality_score: scores.work_quality_score,
          key_work_score: 0,
          total_score: scores.work_volume_score + scores.work_quality_score,
          comments: scores.comments,
          evaluation_date: new Date().toISOString().split('T')[0],
          period: selectedPeriod,
          status: 'pending',
          is_anonymous: formData.is_anonymous,
          evaluation_round: 1,
          weight_factor: 1.0
        };
      }).filter(Boolean);

      const { error } = await supabase
        .from('performance_evaluations')
        .insert(evaluations);

      if (error) throw error;

      toast.success(`成功提交${evaluations.length}条评价`);
      setBatchEvaluationMode(false);
      setShowCreateDialog(false);
      setSelectedUsers([]);
      setBatchScores({});
      fetchEvaluations();
    } catch (error) {
      console.error('批量提交评价失败:', error);
      toast.error('批量提交评价失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 63) return 'text-green-600'; // 90% of 70
    if (score >= 56) return 'text-blue-600';  // 80% of 70
    if (score >= 49) return 'text-yellow-600'; // 70% of 70
    return 'text-red-600';
  };

  if (!permissions.canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">权限不足</h3>
          <p className="text-gray-600">您没有权限查看日常实绩评价</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">日常实绩评价</h3>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {permissions.canCreate && (
          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setEditingEvaluation(null); setBatchEvaluationMode(false); }}>
                  <Plus className="h-4 w-4 mr-1" />
                  新建评价
                </Button>
              </DialogTrigger>
            </Dialog>
            <Button 
              variant="outline" 
              onClick={() => {
                setBatchEvaluationMode(true);
                setShowCreateDialog(true);
                resetForm();
              }}
            >
              <Users className="h-4 w-4 mr-1" />
              批量评价
            </Button>
          </div>
        )}
        
        {permissions.canCreate && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            {batchEvaluationMode ? (
              <BatchEvaluationDialog />
            ) : (
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border shadow-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingEvaluation ? '编辑日常评价' : '新建日常评价'}
                  </DialogTitle>
                </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="evaluated_user_id">被评价人 *</Label>
                  <Select 
                    value={formData.evaluated_user_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, evaluated_user_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue 
                        placeholder="选择被评价人" 
                        selectedLabel={formData.evaluated_user_id ? 
                          users.find(u => u.id === formData.evaluated_user_id)?.name + ' - ' + 
                          users.find(u => u.id === formData.evaluated_user_id)?.department : 
                          undefined
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} - {user.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>



                <div className="space-y-4">
                  <div>
                    <Label htmlFor="work_volume_score">工作任务量 * (0-30分)</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">当前分数：</span>
                        <span className="text-lg font-semibold text-blue-600">{formData.work_volume_score || 0}分</span>
                      </div>
                      <input
                        type="range"
                        id="work_volume_score"
                        min="0"
                        max="30"
                        step="1"
                        value={formData.work_volume_score || 0}
                        onInput={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, work_volume_score: e.target.value }));
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((parseInt(formData.work_volume_score) || 0) / 30) * 100}%, #e5e7eb ${((parseInt(formData.work_volume_score) || 0) / 30) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0分</span>
                        <span>15分</span>
                        <span>30分</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="work_quality_score">工作完成质效 * (0-20分)</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">当前分数：</span>
                        <span className="text-lg font-semibold text-green-600">{formData.work_quality_score || 0}分</span>
                      </div>
                      <input
                        type="range"
                        id="work_quality_score"
                        min="0"
                        max="20"
                        step="1"
                        value={formData.work_quality_score || 0}
                        onInput={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, work_quality_score: e.target.value }));
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #10b981 0%, #10b981 ${((parseInt(formData.work_quality_score) || 0) / 20) * 100}%, #e5e7eb ${((parseInt(formData.work_quality_score) || 0) / 20) * 100}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0分</span>
                        <span>10分</span>
                        <span>20分</span>
                      </div>
                    </div>
                  </div>

                </div>
                
                {formData.work_volume_score && formData.work_quality_score && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-800">
                      总分：{parseInt(formData.work_volume_score) + parseInt(formData.work_quality_score)}分
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      工作任务量：{formData.work_volume_score}分 + 工作完成质效：{formData.work_quality_score}分
                    </div>
                  </div>
                )}



                <div>
                  <Label htmlFor="comments">评价意见</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, comments: e.target.value }));
                    }}
                    placeholder="输入评价意见..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_anonymous"
                    checked={formData.is_anonymous}
                    onChange={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, is_anonymous: e.target.checked }));
                    }}
                    className="rounded"
                  />
                  <Label htmlFor="is_anonymous">匿名评价</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting} 
                    className="flex-1 border-2 border-primary hover:border-primary/80 disabled:border-muted"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {editingEvaluation ? '更新' : '提交'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1"
                  >取消</Button>
                </div>
              </div>
              </DialogContent>
            )}
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载评价数据中...</span>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {evaluations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">被评价人</TableHead>
                    <TableHead className="w-24">职务</TableHead>
                    <TableHead className="w-20">工作任务量</TableHead>
                    <TableHead className="w-20">工作完成质效</TableHead>
                    <TableHead className="w-20">重点工作</TableHead>
                    <TableHead className="w-16">总分</TableHead>
                    <TableHead className="w-24">评价人</TableHead>
                    <TableHead className="w-24">评价日期</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                    <TableHead className="w-32">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{evaluation.evaluated_user.name}</div>
                            <div className="text-sm text-gray-500">{evaluation.evaluated_user.departments?.name || '未设置部门'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{evaluation.evaluated_user?.role || '未设置'}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(evaluation.work_volume_score || 0)}`}>
                          {evaluation.work_volume_score || 0}分
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(evaluation.work_quality_score || 0)}`}>
                          {evaluation.work_quality_score || 0}分
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(evaluation.key_work_score || 0)}`}>
                          {evaluation.key_work_score || 0}分
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${getScoreColor(evaluation.total_score || 0)}`}>
                          {evaluation.total_score || 0}分
                        </span>
                      </TableCell>
                      <TableCell>
                        {evaluation.evaluator?.name}
                      </TableCell>
                      <TableCell>{new Date(evaluation.evaluation_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_LABELS[evaluation.status]?.color}>
                          {STATUS_LABELS[evaluation.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {permissions.canEdit && evaluation.evaluator_id === user?.id && evaluation.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(evaluation)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.canEdit && evaluation.evaluator_id === user?.id && evaluation.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(evaluation.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          {permissions.canApprove && evaluation.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(evaluation.id, 'approved')}
                                className="text-green-600 hover:text-green-700"
                              >
                                通过
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(evaluation.id, 'rejected')}
                                className="text-red-600 hover:text-red-700"
                              >
                                驳回
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">暂无评价记录</h3>
                <p className="text-gray-600">还没有{selectedPeriod}年的日常实绩评价记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};