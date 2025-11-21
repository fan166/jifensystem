import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Calendar, User, Star, Edit, Trash2, Award, Users, Check, X, Filter } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDynamicPermissionCheck, useRoleCheck } from '../hooks/usePermissionCheck';
import { useEvaluationVisibility } from '../hooks/useEvaluationVisibility';

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

interface AnnualEvaluation {
  id: string;
  evaluated_user_id: string;
  evaluator_id: string;
  batch_id: string | null;
  evaluation_type: string;
  work_volume_score: number;
  work_quality_score: number;
  key_work_score: number;
  total_score: number;
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

const EVALUATION_ROUNDS = [
  { value: 1, label: '第一轮' },
  { value: 2, label: '第二轮' },
  { value: 3, label: '第三轮' }
];

// 工作任务量评分标准（30分）
const WORK_VOLUME_SCORES = [
  { value: 30, label: '超额完成', description: '超额完成工作任务' },
  { value: 24, label: '正常完成', description: '按时完成工作任务' },
  { value: 18, label: '基本完成', description: '基本完成工作任务' },
  { value: 12, label: '部分未完成', description: '部分工作任务未完成' }
];

// 工作完成质效评分标准（20分）
const WORK_QUALITY_SCORES = [
  { value: 20, label: '超额完成', description: '工作质量优秀，超出预期' },
  { value: 16, label: '正常完成', description: '工作质量良好，符合要求' },
  { value: 12, label: '基本完成', description: '工作质量一般，基本达标' },
  { value: 8, label: '部分未完成', description: '工作质量较差，需要改进' }
];

// 重点工作评分标准（20分）
const KEY_WORK_SCORES = [
  { value: 20, label: '超额完成', description: '重点工作完成出色' },
  { value: 16, label: '正常完成', description: '重点工作按要求完成' },
  { value: 12, label: '基本完成', description: '重点工作基本完成' },
  { value: 8, label: '部分未完成', description: '重点工作完成不理想' }
];

export const AnnualEvaluationTab: React.FC = () => {
  const [evaluations, setEvaluations] = useState<AnnualEvaluation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<EvaluationBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<AnnualEvaluation | null>(null);
  const { user } = useAuth();
  const { hasPermission } = useDynamicPermissionCheck('view_annual_evaluation');
  const { userRole, isAdmin, isLeader } = useRoleCheck();
  const { annualVisible } = useEvaluationVisibility();
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
  const [batchEvaluationMode, setBatchEvaluationMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [batchScores, setBatchScores] = useState<Record<string, { work_volume_score: number; work_quality_score: number; comments: string }>>({});

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

  // 当可见性或角色发生变化时，实时更新权限
  useEffect(() => {
    checkPermissions();
  }, [annualVisible, isAdmin, isLeader, user?.role]);

  const checkPermissions = async () => {
    // 员工受可见性开关控制；管理员和领导不受影响
    const isEmployee = user?.role === 'employee';
    const canView = isEmployee ? !!annualVisible : true;
    const canCreate = isEmployee ? !!annualVisible : true;
    const canEdit = isEmployee ? !!annualVisible : true;
    setPermissions({
      canView,
      canCreate,
      canEdit,
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
      
      // 转换数据格式，确保department字段正确
      type RawUser = { id: string; name: string; role: string; department?: { name: string } | { name: string }[] };
      const rawUsers = (data || []) as RawUser[];
      const formattedUsers = rawUsers.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        department: Array.isArray(u.department)
          ? (u.department[0]?.name ?? '未分配部门')
          : (u.department?.name ?? '未分配部门')
      }));
      
      setUsers(formattedUsers);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchBatches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .rpc('get_user_accessible_batches', { p_user_id: user.id });

      if (error) throw error;
      
      const annualBatches = (data || []).filter(
        (batch: EvaluationBatch) => batch.evaluation_type === 'annual'
      );
      setBatches(annualBatches);
    } catch (error) {
      console.error('获取评价批次失败:', error);
    }
  };

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('performance_evaluations')
        .select(`
          *,
          evaluated_user:evaluated_user_id(id, name, department, role),
          evaluator:evaluator_id(id, name, department, role),
          batch:batch_id(id, batch_name, evaluation_type, status)
        `)
        .eq('evaluation_type', 'annual')
        .eq('period', selectedPeriod)
        .order('created_at', { ascending: false });

      // 根据权限过滤数据
      if (!permissions.canApprove) {
        query = query.or(`evaluator_id.eq.${user?.id},evaluated_user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvaluations(data || []);
    } catch (error) {
      console.error('获取年终测评失败:', error);
      toast.error('获取年终测评失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.evaluated_user_id || !formData.work_volume_score || !formData.work_quality_score) {
      toast.error('请填写必填字段');
      return;
    }

    const workVolumeScore = parseInt(formData.work_volume_score);
    const workQualityScore = parseInt(formData.work_quality_score);
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
        evaluation_type: 'annual',
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

      toast.success(editingEvaluation ? '测评更新成功' : '测评提交成功');
      setShowCreateDialog(false);
      setEditingEvaluation(null);
      resetForm();
      fetchEvaluations();
    } catch (error) {
      console.error('提交测评失败:', error);
      toast.error('提交测评失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (evaluation: AnnualEvaluation) => {
    setEditingEvaluation(evaluation);
    setFormData({
      evaluated_user_id: evaluation.evaluated_user_id,
      work_volume_score: evaluation.work_volume_score.toString(),
      work_quality_score: evaluation.work_quality_score.toString(),
      comments: evaluation.comments,
      is_anonymous: evaluation.is_anonymous
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条测评吗？')) return;

    try {
      const { error } = await supabase
        .from('performance_evaluations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('测评删除成功');
      fetchEvaluations();
    } catch (error) {
      console.error('删除测评失败:', error);
      toast.error('删除测评失败');
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
      toast.success(`测评${status === 'approved' ? '审核通过' : '已驳回'}`);
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
    setSelectedUsers([]);
  };

  // 批量评价事件处理函数
  const handleWorkVolumeChange = (userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: parseFloat(value) || 0,
        work_quality_score: prev[userId]?.work_quality_score || 0,
        comments: prev[userId]?.comments || ''
      }
    }));
  };

  const handleWorkQualityChange = (userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: prev[userId]?.work_volume_score || 0,
        work_quality_score: parseFloat(value) || 0,
        comments: prev[userId]?.comments || ''
      }
    }));
  };

  const handleCommentsChange = (userId: string, value: string) => {
    setBatchScores(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        work_volume_score: prev[userId]?.work_volume_score || 0,
        work_quality_score: prev[userId]?.work_quality_score || 0,
        comments: value
      }
    }));
  };

  const handleBatchSubmit = async () => {
    if (!user || selectedUsers.length === 0) {
      toast.error('请选择被评价人');
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
          evaluation_type: 'annual',
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

      toast.success(`成功提交${evaluations.length}个年终测评`);
      setShowCreateDialog(false);
      setBatchEvaluationMode(false);
      setSelectedUsers([]);
      setBatchScores({});
      resetForm();
      fetchEvaluations();
    } catch (error) {
      console.error('批量提交失败:', error);
      toast.error('批量提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 63) return 'text-green-600';
    if (score >= 56) return 'text-blue-600';
    if (score >= 49) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRoundBadgeColor = (round: number) => {
    switch (round) {
      case 1: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      case 3: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!permissions.canView) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">权限不足</h3>
          <p className="text-gray-600">您没有权限查看年终集体测评</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* 移除：标题与期间选择器容器 */}
        {permissions.canCreate && (
          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <div 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
                  onClick={() => { resetForm(); setEditingEvaluation(null); setBatchEvaluationMode(false); }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新建测评
                </div>
            <div 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 cursor-pointer"
              onClick={() => { resetForm(); setEditingEvaluation(null); setBatchEvaluationMode(true); setShowCreateDialog(true); }}
            >
              <Users className="h-4 w-4 mr-1" />
              批量测评
            </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {batchEvaluationMode ? '批量年终测评' : editingEvaluation ? '编辑年终测评' : '新建年终测评'}
                  </DialogTitle>
                </DialogHeader>
                
                {batchEvaluationMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>选择被测评人 *</Label>
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
                            <span>{user.name} - {user.department}</span>
                          </label>
                        ))}
                      </div>
                      {selectedUsers.length > 0 && (
                        <div className="text-sm text-blue-600 mt-2">
                          已选择 {selectedUsers.length} 人
                        </div>
                      )}
                    </div>

                    {selectedUsers.length > 0 && (
                      <div className="space-y-6">
                        {selectedUsers.map(userId => {
                          const user = users.find(u => u.id === userId);
                          if (!user) return null;

                          return (
                            <div key={userId} className="border rounded-lg p-4 bg-gray-50">
                              <div className="mb-4">
                                <h4 className="text-lg font-medium text-gray-900">{user.name}</h4>
                                <p className="text-sm text-gray-600">{user.department}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    工作任务量 (0-30分)
                                  </label>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-600">当前分数：</span>
                                      <span className="text-lg font-semibold text-blue-600">{batchScores[userId]?.work_volume_score || 0}分</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="30"
                                      step="1"
                                      value={batchScores[userId]?.work_volume_score || 0}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleWorkVolumeChange(userId, e.target.value);
                                      }}
                                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                      style={{
                                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((batchScores[userId]?.work_volume_score || 0) / 30) * 100}%, #e5e7eb ${((batchScores[userId]?.work_volume_score || 0) / 30) * 100}%, #e5e7eb 100%)`
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
                                      <span className="text-lg font-semibold text-green-600">{batchScores[userId]?.work_quality_score || 0}分</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="20"
                                      step="1"
                                      value={batchScores[userId]?.work_quality_score || 0}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleWorkQualityChange(userId, e.target.value);
                                      }}
                                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                      style={{
                                        background: `linear-gradient(to right, #10b981 0%, #10b981 ${((batchScores[userId]?.work_quality_score || 0) / 20) * 100}%, #e5e7eb ${((batchScores[userId]?.work_quality_score || 0) / 20) * 100}%, #e5e7eb 100%)`
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

                              {batchScores[userId]?.work_volume_score && batchScores[userId]?.work_quality_score && (
                                <div className="p-3 bg-blue-50 rounded-lg mt-4">
                                  <div className="text-sm font-medium text-blue-800">
                                    总分：{(batchScores[userId]?.work_volume_score || 0) + (batchScores[userId]?.work_quality_score || 0)}分 / 50分
                                  </div>
                                  <div className="text-xs text-blue-600 mt-1">
                                    工作任务量：{batchScores[userId]?.work_volume_score || 0}分 + 工作完成质效：{batchScores[userId]?.work_quality_score || 0}分
                                  </div>
                                </div>
                              )}

                              <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  测评意见
                                </label>
                                <textarea
                                  value={batchScores[userId]?.comments || ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleCommentsChange(userId, e.target.value);
                                  }}
                                  placeholder="输入测评意见..."
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
                      <Checkbox
                        id="is_anonymous"
                        checked={formData.is_anonymous}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_anonymous: !!checked }))}
                      />
                      <Label htmlFor="is_anonymous">匿名测评</Label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <div className="flex-1 border border-input bg-background rounded-md">
                        <Button 
                          type="button" 
                          onClick={handleBatchSubmit} 
                          disabled={submitting || selectedUsers.length === 0}
                          className="w-full border-0 bg-transparent hover:bg-accent hover:text-accent-foreground"
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : null}
                          批量提交 ({selectedUsers.length}人)
                        </Button>
                      </div>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowCreateDialog(false)}
                        className="flex-1"
                      >取消</Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="evaluated_user_id">被测评人 *</Label>
                  <Select 
                    value={formData.evaluated_user_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, evaluated_user_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue 
                        placeholder="选择被测评人" 
                        selectedLabel={
                          formData.evaluated_user_id 
                            ? users.find(user => user.id === formData.evaluated_user_id)
                                ? `${users.find(user => user.id === formData.evaluated_user_id)!.name} - ${users.find(user => user.id === formData.evaluated_user_id)!.department}`
                                : undefined
                            : undefined
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
                        onChange={(e) => setFormData(prev => ({ ...prev, work_volume_score: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, work_quality_score: e.target.value }))}
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
                      总分：{parseInt(formData.work_volume_score) + parseInt(formData.work_quality_score)}分 / 50分
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      工作任务量：{formData.work_volume_score}分 + 工作完成质效：{formData.work_quality_score}分
                    </div>
                  </div>
                )}



                <div>
                  <Label htmlFor="comments">测评意见</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="输入测评意见..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_anonymous"
                    checked={formData.is_anonymous}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_anonymous: !!checked }))}
                  />
                  <Label htmlFor="is_anonymous">匿名测评</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
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
                  >
                    取消
                  </Button>
                </div>
              </form>
                )}
            </DialogContent>
          </Dialog>
        </div>
      )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载测评数据中...</span>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {evaluations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>被测评人</TableHead>
                    <TableHead>职务</TableHead>
                    <TableHead>测评人</TableHead>
                    <TableHead>评分详情</TableHead>
                    <TableHead>总分</TableHead>
                    <TableHead>轮次</TableHead>
                    <TableHead>批次</TableHead>
                    <TableHead>测评日期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
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
                            <div className="text-sm text-gray-500">{evaluation.evaluated_user.department}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{evaluation.evaluated_user.role}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {evaluation.is_anonymous ? '匿名测评' : evaluation.evaluator.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>任务量: {evaluation.work_volume_score}分</div>
                          <div>质量: {evaluation.work_quality_score}分</div>
                          <div>重点: {evaluation.key_work_score}分</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getScoreColor(evaluation.total_score)}`}>
                          {evaluation.total_score}分
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoundBadgeColor(evaluation.evaluation_round)}>
                          第{evaluation.evaluation_round}轮
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {evaluation.batch ? (
                          <Badge variant="outline">{evaluation.batch.batch_name}</Badge>
                        ) : (
                          <span className="text-gray-400">无批次</span>
                        )}
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
                <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">暂无测评记录</h3>
                <p className="text-gray-600">还没有{selectedPeriod}年的年终集体测评记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};