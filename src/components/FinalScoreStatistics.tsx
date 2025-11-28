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
  const [selectedPeriod, setSelectedPeriod] = useState(String(new Date().getFullYear()));
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const { user } = useAuth();
  const calcPerm = useDynamicPermissionCheck('calculate_final_scores');
  const exportPerm = useDynamicPermissionCheck('export_final_scores');
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
  }, [selectedPeriod, selectedDepartment, userRole, user?.id]);

  useEffect(() => {
    calculateStatistics();
  }, [finalScores]);

  const checkPermissions = async () => {
    setPermissions({
      canView: true,
      canCalculate: calcPerm.hasPermission || isAdmin,
      canExport: exportPerm.hasPermission || isAdmin
    });
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('department:departments(name)');

      if (error) throw error;

      const names = (data || []).map((u: any) => Array.isArray(u.department) ? (u.department[0]?.name ?? '') : (u.department?.name ?? ''));
      const uniqueDepartments = [...new Set(names)].filter(Boolean);
      setDepartments(uniqueDepartments);
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const fetchFinalScores = async () => {
    setLoading(true);
    try {
      // 基础查询（不依赖嵌套关系）
      let { data: rows, error } = await supabase
        .from('final_performance_scores')
        .select('*')
        .eq('period', selectedPeriod)
        .order('final_score', { ascending: false });
      // 若表不存在则回退到按测评记录计算
      if (error && (error as any).code === 'PGRST205') {
        rows = [];
      } else if (error) {
        throw error;
      }
      rows = rows || [];

      // 角色过滤（员工仅查看自己）
      let filteredRows = rows;
      if (userRole === 'employee') {
        filteredRows = filteredRows.filter(r => r.user_id === user?.id);
      }

      // 关联用户并取部门名称
      const userIds = Array.from(new Set(filteredRows.map(r => r.user_id).filter(Boolean)));
      let usersMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, role, department:departments(name)')
          .in('id', userIds);
        (usersData || []).forEach((u: any) => usersMap.set(u.id, {
          id: u.id,
          name: u.name,
          role: u.role,
          department: Array.isArray(u.department) ? (u.department?.[0]?.name ?? '未分配部门') : (u.department?.name ?? '未分配部门')
        }));
      }

      // 管理员按部门筛选（前端过滤）
      if (userRole !== 'employee' && selectedDepartment !== 'all') {
        filteredRows = filteredRows.filter(r => {
          const u = usersMap.get(r.user_id);
          return (u?.department || '') === selectedDepartment;
        });
      }

      let enriched: any[] = filteredRows.map(r => ({
        ...r,
        user: usersMap.get(r.user_id)
      }));

      // 若最终积分表无数据，则从测评表计算
      if (enriched.length === 0) {
        const { data: evals, error: evalErr } = await supabase
          .from('performance_evaluations')
          .select('evaluated_user_id, evaluation_type, total_score, status, period')
          .eq('period', selectedPeriod)
          .in('status', ['approved', 'submitted']);
        if (evalErr) throw evalErr;
        const byUser = new Map<string, { daily: number[]; annual: number[] }>();
        (evals || []).forEach((e: any) => {
          const uid = e.evaluated_user_id;
          if (!uid) return;
          const bucket = byUser.get(uid) || { daily: [], annual: [] };
          if (e.evaluation_type === 'daily') bucket.daily.push(Number(e.total_score) || 0);
          else if (e.evaluation_type === 'annual') bucket.annual.push(Number(e.total_score) || 0);
          byUser.set(uid, bucket);
        });
        const computedRows = Array.from(byUser.entries()).map(([uid, buckets]) => {
          const dailyAvg = buckets.daily.length ? buckets.daily.reduce((a, b) => a + b, 0) / buckets.daily.length : 0;
          const annualAvg = buckets.annual.length ? buckets.annual.reduce((a, b) => a + b, 0) / buckets.annual.length : 0;
          const final = Number((dailyAvg + annualAvg).toFixed(2));
          return {
            id: `${uid}-${selectedPeriod}`,
            user_id: uid,
            period: selectedPeriod,
            daily_avg_score: Number(dailyAvg.toFixed(2)),
            annual_avg_score: Number(annualAvg.toFixed(2)),
            final_score: final,
            daily_evaluation_count: buckets.daily.length,
            annual_evaluation_count: buckets.annual.length,
            calculation_details: null,
            calculated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any;
        });
        // 关联用户信息并应用部门筛选
        const compUserIds = computedRows.map(r => r.user_id);
        const { data: compUsers } = await supabase
          .from('users')
          .select('id, name, role, department:departments(name)')
          .in('id', compUserIds);
        const compMap = new Map<string, any>();
        (compUsers || []).forEach((u: any) => compMap.set(u.id, {
          id: u.id,
          name: u.name,
          role: u.role,
          department: Array.isArray(u.department) ? (u.department?.[0]?.name ?? '未分配部门') : (u.department?.name ?? '未分配部门')
        }));

        let compFiltered = computedRows;
        if (userRole === 'employee') compFiltered = compFiltered.filter(r => r.user_id === user?.id);
        if (userRole !== 'employee' && selectedDepartment !== 'all') {
          compFiltered = compFiltered.filter(r => {
            const u = compMap.get(r.user_id);
            return (u?.department || '') === selectedDepartment;
          });
        }

        enriched = compFiltered.map(r => ({ ...r, user: compMap.get(r.user_id) })) as any;
      }

      setFinalScores(enriched);
    } catch (error) {
      console.error('获取最终积分失败:', error);
      toast.error('获取最终积分失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = async () => {
    try {
      const rows = finalScores || [];
      if (!rows.length) {
        setStatistics(null);
        return;
      }
      const scores = rows.map((r: any) => r.final_score).filter((s: any) => typeof s === 'number');
      if (!scores.length) {
        setStatistics(null);
        return;
      }
      const totalUsers = scores.length;
      const avgScore = scores.reduce((sum: number, score: number) => sum + score, 0) / totalUsers;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const distribution = {
        excellent: scores.filter((s: number) => s >= 90).length,
        good: scores.filter((s: number) => s >= 80 && s < 90).length,
        average: scores.filter((s: number) => s >= 70 && s < 80).length,
        poor: scores.filter((s: number) => s < 70).length
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
