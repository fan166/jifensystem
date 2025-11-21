import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Loader2, TrendingUp, Calendar, Award, Eye, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useDynamicPermissionCheck } from '../hooks/usePermissionCheck';

interface FinalScore {
  id: string;
  user_id: string;
  period: string;
  daily_score: number;
  annual_score: number;
  final_score: number;
  calculation_details: {
    daily_evaluation_count: number;
    annual_evaluation_count: number;
    daily_average: number;
    annual_average: number;
    calculation_formula: string;
  };
  daily_evaluation_count: number;
  annual_evaluation_count: number;
  last_calculated_at: string;
  is_final: boolean;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface EvaluationDetail {
  id: string;
  evaluation_type: 'daily' | 'annual';
  score: number;
  evaluator_name: string;
  evaluation_date: string;
  is_anonymous: boolean;
  comments: string;
  status: string;
}

const PERIOD_OPTIONS = [
  { value: '2024', label: '2024年' },
  { value: '2023', label: '2023年' },
  { value: '2022', label: '2022年' }
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'pending': { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  'approved': { label: '已审核', color: 'bg-green-100 text-green-800' },
  'rejected': { label: '已驳回', color: 'bg-red-100 text-red-800' }
};

export const PersonalScoreView: React.FC = () => {
  const [finalScores, setFinalScores] = useState<FinalScore[]>([]);
  const [evaluationDetails, setEvaluationDetails] = useState<EvaluationDetail[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('2024');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { user } = useAuth();
  const { hasPermission } = useDynamicPermissionCheck('view_personal_scores');
  const [canViewPersonalScores, setCanViewPersonalScores] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    if (canViewPersonalScores && user) {
      fetchFinalScores();
    }
  }, [canViewPersonalScores, user, selectedPeriod]);

  const checkPermissions = async () => {
    const canView = await hasPermission;
    setCanViewPersonalScores(Boolean(canView));
  };

  const fetchFinalScores = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('final_performance_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('period', selectedPeriod)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setFinalScores(data || []);
    } catch (error) {
      console.error('获取个人积分失败:', error);
      toast.error('获取个人积分失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvaluationDetails = async () => {
    if (!user) return;

    setDetailsLoading(true);
    try {
      const { data, error } = await supabase
        .from('performance_evaluations')
        .select(`
          id,
          evaluation_type,
          score,
          evaluation_date,
          is_anonymous,
          comments,
          status,
          evaluator:evaluator_id(name)
        `)
        .eq('evaluated_user_id', user.id)
        .eq('period', selectedPeriod)
        .eq('status', 'approved')
        .order('evaluation_date', { ascending: false });

      if (error) throw error;

      const formattedData: EvaluationDetail[] = (data || []).map(item => ({
        id: item.id,
        evaluation_type: item.evaluation_type,
        score: item.score,
        evaluator_name: item.is_anonymous ? '匿名评价' : (Array.isArray(item.evaluator) ? (item.evaluator[0] as any)?.name || '未知' : (item.evaluator as any)?.name || '未知'),
        evaluation_date: item.evaluation_date,
        is_anonymous: item.is_anonymous,
        comments: item.comments || '',
        status: item.status
      }));

      setEvaluationDetails(formattedData);
    } catch (error) {
      console.error('获取评价详情失败:', error);
      toast.error('获取评价详情失败');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleShowDetails = () => {
    if (!showDetails) {
      fetchEvaluationDetails();
    }
    setShowDetails(!showDetails);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLevel = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '合格';
    return '待改进';
  };

  if (!canViewPersonalScores) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">权限不足</h3>
          <p className="text-gray-600">您没有权限查看个人积分</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载个人积分中...</span>
      </div>
    );
  }

  const currentScore = finalScores[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          <h2 className="text-xl font-semibold">个人积分查看</h2>
        </div>
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

      {currentScore ? (
        <div className="grid gap-6">
          {/* 积分概览卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {selectedPeriod}年度积分概览
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className={`text-2xl font-bold ${getScoreColor(currentScore.final_score)}`}>
                    {currentScore.final_score.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">最终积分</div>
                  <Badge variant="outline" className="mt-2">
                    {getScoreLevel(currentScore.final_score)}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className={`text-2xl font-bold ${getScoreColor(currentScore.daily_score)}`}>
                    {currentScore.daily_score.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">日常实绩评价</div>
                  <div className="text-xs text-gray-500 mt-1">
                    权重: 80%
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className={`text-2xl font-bold ${getScoreColor(currentScore.annual_score)}`}>
                    {currentScore.annual_score.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">年终集体测评</div>
                  <div className="text-xs text-gray-500 mt-1">
                    权重: 20%
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">日常评价次数:</span>
                    <span className="ml-2 font-medium">{currentScore.daily_evaluation_count}次</span>
                  </div>
                  <div>
                    <span className="text-gray-600">年终评价次数:</span>
                    <span className="ml-2 font-medium">{currentScore.annual_evaluation_count}次</span>
                  </div>
                  <div>
                    <span className="text-gray-600">最后计算时间:</span>
                    <span className="ml-2 font-medium">
                      {new Date(currentScore.last_calculated_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">审核状态:</span>
                    <Badge 
                      variant="outline" 
                      className={`ml-2 ${currentScore.is_final ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                    >
                      {currentScore.is_final ? '已确认' : '待确认'}
                    </Badge>
                  </div>
                </div>
              </div>

              {currentScore.calculation_details && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">计算详情</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>日常评价平均分: {currentScore.calculation_details.daily_average?.toFixed(2) || 'N/A'}</p>
                    <p>年终评价平均分: {currentScore.calculation_details.annual_average?.toFixed(2) || 'N/A'}</p>
                    <p>计算公式: {currentScore.calculation_details.calculation_formula || '日常×80% + 年终×20%'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 评价详情 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  评价详情
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShowDetails}
                  disabled={detailsLoading}
                >
                  {detailsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="ml-1">
                    {showDetails ? '隐藏详情' : '查看详情'}
                  </span>
                </Button>
              </div>
            </CardHeader>
            {showDetails && (
              <CardContent>
                {evaluationDetails.length > 0 ? (
                  <div className="space-y-3">
                    {evaluationDetails.map((detail) => (
                      <div key={detail.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={detail.evaluation_type === 'daily' ? 'default' : 'secondary'}>
                              {detail.evaluation_type === 'daily' ? '日常评价' : '年终测评'}
                            </Badge>
                            <span className={`font-medium ${getScoreColor(detail.score)}`}>
                              {detail.score}分
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(detail.evaluation_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          评价人: {detail.evaluator_name}
                        </div>
                        {detail.comments && (
                          <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {detail.comments}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>暂无评价记录</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Award className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">暂无积分记录</h3>
            <p className="text-gray-600">{selectedPeriod}年度还没有积分记录</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};