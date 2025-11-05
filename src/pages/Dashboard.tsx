import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, List, Badge, Spin, Progress, Button } from 'antd';
import { TrophyOutlined, UserOutlined, FileTextOutlined, StarOutlined, RocketOutlined, GiftOutlined, BarChartOutlined, TeamOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { scoreAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [scoreStats, setScoreStats] = useState({
    totalScore: 0,
    basicDuty: 0,
    workPerformance: 0,
    keyWork: 0,
    bonus: 0
  });

  const [userRank, setUserRank] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [monthlyProgress, setMonthlyProgress] = useState({
    target: 100,
    current: 0,
    percentage: 0
  });
  const { user } = useAuthStore();
  // 加载数据
  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.id) return;
    
    // 网络不可达时直接跳过加载，避免报错干扰UI
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      console.warn('网络不可用，跳过仪表板数据加载');
      return;
    }

    setLoading(true);
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7);

      const results = await Promise.allSettled([
        scoreAPI.getUserScoreStats(user.id, currentPeriod),
        scoreAPI.getScoreRanking(currentPeriod),
        scoreAPI.getScores({ userId: user.id })
      ]);

      const stats = results[0].status === 'fulfilled' ? results[0].value : { totalScore: 0, basicDuty: 0, workPerformance: 0, keyWork: 0, bonus: 0 };
      const rankingData = results[1].status === 'fulfilled' ? results[1].value : [];
      const userScores = results[2].status === 'fulfilled' ? results[2].value : [];

      setScoreStats(stats);

      // 找到当前用户的排名
      const userRankIndex = rankingData.findIndex((item: any) => item.userId === user.id);
      setUserRank(userRankIndex >= 0 ? userRankIndex + 1 : 0);

      // 生成积分历史趋势数据（最近6个月）
      const last6Months: any[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        const monthName = date.toLocaleDateString('zh-CN', { month: 'short' });
        
        const monthScores = userScores.filter((score: any) => 
          score.created_at?.startsWith(monthKey)
        );
        const totalScore = monthScores.reduce((sum: number, score: any) => sum + (score.score || 0), 0);
        
        last6Months.push({
          month: monthName,
          score: totalScore,
          basicDuty: monthScores.filter((s: any) => s.score_type?.category === '基本职责').reduce((sum: number, s: any) => sum + (s.score || 0), 0),
          workPerformance: monthScores.filter((s: any) => s.score_type?.category === '工作实绩').reduce((sum: number, s: any) => sum + (s.score || 0), 0),
          keyWork: monthScores.filter((s: any) => s.score_type?.category === '重点工作').reduce((sum: number, s: any) => sum + (s.score || 0), 0),
          bonus: monthScores.filter((s: any) => s.score_type?.category === '绩效奖励').reduce((sum: number, s: any) => sum + (s.score || 0), 0)
        });
      }
      
      setScoreHistory(last6Months);
      
      // 计算月度进度
      const currentMonthScores = userScores.filter((score: any) => 
        score.created_at?.startsWith(currentPeriod)
      );
      const currentMonthTotal = currentMonthScores.reduce((sum: number, score: any) => sum + (score.score || 0), 0);
      const target = 100; // 假设月度目标为100分
      
      setMonthlyProgress({
        target,
        current: currentMonthTotal,
        percentage: Math.min((currentMonthTotal / target) * 100, 100)
      });
      
      // 设置最近活动（用户的最新积分记录）
      const recentScores = userScores
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8)
        .map((score: any) => ({
          id: score.id,
          scoreType: score.score_type?.name || '未知类型',
          category: score.score_type?.category || '其他',
          score: score.score,
          reason: score.reason,
          time: new Date(score.created_at).toLocaleDateString()
        }));
      
      setRecentActivities(recentScores);
      
    } catch (error) {
      console.error('加载仪表板数据失败:', error);
    } finally {
      setLoading(false);
    }
  };


  


  return (
    <div className="p-6">
      <Title level={3} className="mb-6">我的积分详情</Title>
      
      <Spin spinning={loading}>
        {/* 积分概览卡片 */}
        {/* 第一行：总积分和当前排名 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} md={12}>
            <Card className="text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-blue-600 mb-2">{scoreStats.totalScore.toFixed(1)}</div>
              <div className="text-gray-500">总积分</div>
              <div className="text-xs text-gray-400 mt-1">点击查看详情</div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card className="text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl font-bold text-green-600 mb-2">#{userRank || '-'}</div>
              <div className="text-gray-500">当前排名</div>
              <div className="text-xs text-gray-400 mt-1">全员排名</div>
            </Card>
          </Col>
        </Row>

        {/* 第二行：四个积分类别 */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} md={6}>
            <Card className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/basic-duty-score')}>
              <div className="text-3xl font-bold text-orange-600 mb-2">{scoreStats.basicDuty.toFixed(1)}</div>
              <div className="text-gray-500">基本职责</div>
              <div className="text-xs text-gray-400 mt-1">考勤·学习·纪律</div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/performance-evaluation')}>
              <div className="text-3xl font-bold text-purple-600 mb-2">{scoreStats.workPerformance.toFixed(1)}</div>
              <div className="text-gray-500">工作实绩</div>
              <div className="text-xs text-gray-400 mt-1">任务报备·评分</div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/key-work-score')}>
              <div className="text-3xl font-bold text-red-600 mb-2">{scoreStats.keyWork.toFixed(1)}</div>
              <div className="text-gray-500">重点工作</div>
              <div className="text-xs text-gray-400 mt-1">任务分配·闭环</div>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="text-center hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/bonus-score')}>
              <div className="text-3xl font-bold text-indigo-600 mb-2">{scoreStats.bonus.toFixed(1)}</div>
              <div className="text-gray-500">绩效奖励</div>
              <div className="text-xs text-gray-400 mt-1">表彰·奖励</div>
            </Card>
          </Col>
        </Row>





      </Spin>
    </div>
  );
};

export default Dashboard;