import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from 'sonner';
import { Loader2, Calculator, Trophy, TrendingUp, Users, Download, RefreshCw, Award, BarChart3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDynamicPermissionCheck, useRoleCheck } from '../hooks/usePermissionCheck';

interface User {
  id: string;
  name: string;
  department: string;
  role: string;
}

interface FinalScore {
  id: string;
  user_id: string;
  period: string;
  daily_avg_score: number;
  annual_avg_score: number;
  final_score: number;
  daily_evaluation_count: number;
  annual_evaluation_count: number;
  calculation_details: any;
  calculated_at: string;
  created_at: string;
  updated_at: string;
  user: User;
}

interface ScoreStatistics {
  total_users: number;
  avg_final_score: number;
  max_final_score: number;
  min_final_score: number;
  score_distribution: {
    excellent: number; // 90-100
    good: number; // 80-89
    average: number; // 70-79
    poor: number; // <70
  };
}

const PERIOD_OPTIONS = [
  { value: '2024', label: '2024年' },
  { value: '2023', label: '2023年' },
  { value: '2022', label: '2022年' }
];

const SCORE_RANGES = [
  { min: 90, max: 100, label: '优秀', color: 'bg-green-100 text-green-800' },
  { min: 80, max: 89, label: '良好', color: 'bg-blue-100 text-blue-800' },
  { min: 70, max: 79, label: '一般', color: 'bg-yellow-100 text-yellow-800' },
  { min: 0, max: 69, label: '待改进', color: 'bg-red-100 text-red-800' }
];

export const FinalScoreStatistics: React.FC = () => {
  const [finalScores, setFinalScores] = useState<FinalScore[]>([]);
  const [statistics, setStatistics] = useState<ScoreStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const { user } = useAuth();
  const { hasPermission } = useDynamicPermissionCheck('calculate_final_scores');
  const { userRole, isAdmin } = useRoleCheck();
  const [permissions, setPermissions] = useState({
    canView: false,
    canCalculate: false,
    canExport: false
  });

  useEffect(() => {
    checkPermissions();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchFinalScores();
    calculateStatistics();
  }, [selectedPeriod, selectedDepartment, userRole, user?.id]);

  const checkPermissions = async () => {
    const [canCalculate, canExport] = await Promise.all([
      hasPermission,
      (await useDynamicPermissionCheck('export_final_scores')).hasPermission
    ]);

    setPermissions({
      canView: true, // 所有用户都可以查看
      canCalculate: canCalculate || isAdmin,
      canExport: canExport || isAdmin
    });
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .eq('is_active', true);

      if (error) throw error;
      
      const uniqueDepartments = [...new Set(data?.map(u => u.department) || [])];
      setDepartments(uniqueDepartments.filter(Boolean));
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const fetchFinalScores = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('final_performance_scores')
        .select(`
          *,
          user:user_id(id, name, department, role)
        `)
        .eq('period', selectedPeriod)
        .order('final_score', { ascending: false });

      // 如果是普通职工，只能查看自己的积分
      if (userRole === 'employee') {
        query = query.eq('user_id', user?.id);
      } else {
        // 管理员可以按部门筛选
        if (selectedDepartment !== 'all') {
          query = query.eq('user.department', selectedDepartment);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setFinalScores(data || []);
    } catch (error) {
      console.error('获取最终积分失败:', error);
      toast.error('获取最终积分失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = async () => {
    try {
      let query = supabase
        .from('final_performance_scores')
        .select('final_score, user:user_id(department)')
        .eq('period', selectedPeriod);

      // 如果是普通职工，只统计自己的数据
      if (userRole === 'employee') {
        query = query.eq('user_id', user?.id);
      } else {
        // 管理员可以按部门筛选
        if (selectedDepartment !== 'all') {
          query = query.eq('user.department', selectedDepartment);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setStatistics(null);
        return;
      }

      const scores = data.map(item => item.final_score);
      const totalUsers = scores.length;
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / totalUsers;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      const distribution = {
        excellent: scores.filter(s => s >= 90).length,
        good: scores.filter(s => s >= 80 && s < 90).length,
        average: scores.filter(s => s >= 70 && s < 80).length,
        poor: scores.filter(s => s < 70).length
      };

      setStatistics({
        total_users: totalUsers,
        avg_final_score: Math.round(avgScore * 100) / 100,
        max_final_score: maxScore,
        min_final_score: minScore,
        score_distribution: distribution
      });
    } catch (error) {
      console.error('计算统计数据失败:', error);
    }
  };

  const handleCalculateAllScores = async () => {
    if (!confirm(`确定要重新计算${selectedPeriod}年的所有最终积分吗？这可能需要一些时间。`)) {
      return;
    }

    setCalculating(true);
    try {
      const { data, error } = await supabase
        .rpc('calculate_all_final_scores', { p_period: selectedPeriod });

      if (error) throw error;
      
      toast.success(`成功计算了${data || 0}个用户的最终积分`);
      fetchFinalScores();
      calculateStatistics();
    } catch (error) {
      console.error('批量计算积分失败:', error);
      toast.error('批量计算积分失败');
    } finally {
      setCalculating(false);
    }
  };

  const handleExportData = async () => {
    try {
      const csvContent = generateCSV(finalScores);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `最终积分统计_${selectedPeriod}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('数据导出成功');
    } catch (error) {
      console.error('导出数据失败:', error);
      toast.error('导出数据失败');
    }
  };

  const generateCSV = (data: FinalScore[]): string => {
    const headers = ['姓名', '部门', '职位', '日常实绩平均分', '年终测评平均分', '最终积分', '日常评价次数', '年终评价次数', '计算时间'];
    const rows = data.map(score => [
      score.user.name,
      score.user.department,
      score.user.role,
      score.daily_avg_score.toFixed(2),
      score.annual_avg_score.toFixed(2),
      score.final_score.toFixed(2),
      score.daily_evaluation_count,
      score.annual_evaluation_count,
      new Date(score.calculated_at).toLocaleString()
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const getScoreRangeInfo = (score: number) => {
    return SCORE_RANGES.find(range => score >= range.min && score <= range.max) || SCORE_RANGES[3];
  };

  const getRankSuffix = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  // 移除权限检查，所有用户都可以查看（但数据会根据角色过滤）

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="选择年份" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: new Date().getFullYear() - 2025 + 1 }, (_, i) => {
                const y = String(2025 + i);
                return (
                  <SelectItem key={y} value={y}>
                    {y}年
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {/* 只有管理员才能看到操作按钮 */}
          {(userRole === 'system_admin' || userRole === 'assessment_admin') && (
            <>
              <Button 
                onClick={handleCalculateAllScores} 
                disabled={calculating}
                variant="outline"
              >
                {calculating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Calculator className="h-4 w-4 mr-1" />
                )}
                {calculating ? '计算中...' : '重新计算'}
              </Button>
              <Button onClick={handleExportData} variant="outline">
                <Download className="h-4 w-4 mr-1" />
                导出数据
              </Button>
            </>
          )}
          <Button onClick={() => { fetchFinalScores(); calculateStatistics(); }} variant="outline">
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>
        </div>
      </div>

      {/* 统计概览 */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">参评人数</p>
                  <p className="text-2xl font-bold">{statistics.total_users}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">平均分</p>
                  <p className="text-2xl font-bold">{statistics.avg_final_score}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">最高分</p>
                  <p className="text-2xl font-bold">{statistics.max_final_score}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">最低分</p>
                  <p className="text-2xl font-bold">{statistics.min_final_score}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 分数分布 */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle>分数分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SCORE_RANGES.map((range, index) => {
                const count = Object.values(statistics.score_distribution)[index];
                const percentage = statistics.total_users > 0 ? (count / statistics.total_users * 100).toFixed(1) : '0';
                return (
                  <div key={range.label} className="text-center">
                    <Badge className={range.color}>{range.label}</Badge>
                    <p className="text-2xl font-bold mt-2">{count}</p>
                    <p className="text-sm text-gray-600">{percentage}%</p>
                    <p className="text-xs text-gray-500">{range.min}-{range.max}分</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 积分排行榜 */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">加载积分数据中...</span>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>积分排行榜</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {finalScores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>排名</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>日常实绩</TableHead>
                    <TableHead>年终测评</TableHead>
                    <TableHead>最终积分</TableHead>
                    <TableHead>等级</TableHead>
                    <TableHead>计算时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finalScores.map((score, index) => {
                    const rangeInfo = getScoreRangeInfo(score.final_score);
                    return (
                      <TableRow key={score.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getRankSuffix(index)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{score.user.name}</div>
                        </TableCell>
                        <TableCell>{score.user.department}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{score.daily_avg_score.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">({score.daily_evaluation_count}次评价)</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{score.annual_avg_score.toFixed(2)}</div>
                            <div className="text-sm text-gray-500">({score.annual_evaluation_count}次评价)</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-lg">{score.final_score.toFixed(2)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={rangeInfo.color}>{rangeInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(score.calculated_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">暂无积分数据</h3>
                <p className="text-gray-600">还没有{selectedPeriod}年的最终积分数据</p>
                {permissions.canCalculate && (
                  <Button 
                    onClick={handleCalculateAllScores} 
                    disabled={calculating}
                    className="mt-4"
                  >
                    {calculating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Calculator className="h-4 w-4 mr-1" />
                    )}
                    开始计算积分
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};