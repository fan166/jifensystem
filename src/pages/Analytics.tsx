import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Button,
  Typography,
  Space,
  Tag,
  Progress,
  Table,
  Divider
} from 'antd';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  RiseOutlined,
  FallOutlined,
  CalendarOutlined,
  MinusOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useRoleCheck } from '../hooks/usePermissionCheck';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface TrendData {
  date: string;
  totalScore: number;
  basicDuty: number;
  workPerformance: number;
  keyWork: number;
  performanceReward: number;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface DepartmentTrend {
  department: string;
  currentMonth: number;
  lastMonth: number;
  change: number;
  changePercent: number;
}

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('month');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [departmentTrends, setDepartmentTrends] = useState<DepartmentTrend[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalScore: 0,
    avgScore: 0,
    growth: 0,
    growthPercent: 0
  });
  const { user } = useAuth();
  const { userRole } = useRoleCheck();

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const now = dayjs();
      let months: string[] = [];
      if (timeRange === 'custom' && dateRange) {
        const start = dayjs(dateRange[0]).startOf('month');
        const end = dayjs(dateRange[1]).startOf('month');
        let cursor = start.clone();
        while (cursor.isBefore(end) || cursor.isSame(end)) {
          months.push(cursor.format('YYYY-MM'));
          cursor = cursor.add(1, 'month');
        }
      } else {
        const countMap: Record<string, number> = { week: 1, month: 1, quarter: 3, year: 12 };
        const count = countMap[timeRange] ?? 1;
        for (let i = count - 1; i >= 0; i--) {
          months.push(now.subtract(i, 'month').format('YYYY-MM'));
        }
      }

      const BASIC_DUTY_CATEGORY = 'basic_duty';

      const allTrend: TrendData[] = [];
      let sumBasic = 0;
      let sumPerf = 0;
      let sumKey = 0;
      let sumReward = 0;

      for (const m of months) {
        const { data: evals } = await supabase
          .from('performance_evaluations')
          .select('evaluated_user_id, evaluation_type, total_score, status, period')
          .eq('period', m)
          .in('status', ['approved', 'submitted'])
          .limit(2000);
        const buckets = new Map<string, { sum: number; count: number }>();
        (evals || []).forEach((e: any) => {
          const uid = e.evaluated_user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const b = buckets.get(uid) || { sum: 0, count: 0 };
          b.sum += Number(e.total_score) || 0;
          b.count += 1;
          buckets.set(uid, b);
        });
        const perfSum = buckets.size
          ? Array.from(buckets.values()).reduce((acc, b) => acc + (b.sum / Math.max(1, b.count)), 0)
          : 0;

        const { data: dutyScores } = await supabase
          .from('scores')
          .select('user_id, score, period, score_type:score_types(category)')
          .eq('period', m)
          .limit(5000);
        const basicByUser = new Map<string, number>();
        (dutyScores || []).forEach((s: any) => {
          const uid = s.user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const category = s?.score_type?.category || '';
          if (category !== BASIC_DUTY_CATEGORY) return;
          const prev = basicByUser.get(uid) || 0;
          const val = Number(s.score) || 0;
          basicByUser.set(uid, prev + (val < 0 ? Math.abs(val) : 0));
        });
        const basicSum = basicByUser.size
          ? Array.from(basicByUser.values()).reduce((acc, ded) => acc + Math.max(0, 20 - ded), 0)
          : 0;

        const { data: rewards } = await supabase
          .from('reward_score_records')
          .select('user_id, score, award_period')
          .eq('award_period', m)
          .limit(5000);
        const rewardByUser = new Map<string, number>();
        (rewards || []).forEach((r: any) => {
          const uid = r.user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const prev = rewardByUser.get(uid) || 0;
          rewardByUser.set(uid, prev + (Number(r.score) || 0));
        });
        const rewardSum = rewardByUser.size
          ? Array.from(rewardByUser.values()).reduce((acc, v) => acc + v, 0)
          : 0;

        const keyWork = 0;
        const total = Number((perfSum + basicSum + rewardSum + keyWork).toFixed(2));
        allTrend.push({
          date: dayjs(m + '-01').toISOString(),
          totalScore: total,
          basicDuty: Number(basicSum.toFixed(2)),
          workPerformance: Number(perfSum.toFixed(2)),
          keyWork: Number(keyWork.toFixed(2)),
          performanceReward: Number(rewardSum.toFixed(2))
        });

        sumBasic += basicSum;
        sumPerf += perfSum;
        sumKey += keyWork;
        sumReward += rewardSum;
      }

      setTrendData(allTrend);

      const cat: CategoryData[] = [
        { name: '基本职责', value: Number(sumBasic.toFixed(2)), color: '#52c41a' },
        { name: '工作实绩', value: Number(sumPerf.toFixed(2)), color: '#faad14' },
        { name: '重点工作', value: Number(sumKey.toFixed(2)), color: '#722ed1' },
        { name: '绩效奖励', value: Number(sumReward.toFixed(2)), color: '#eb2f96' }
      ];
      setCategoryData(cat);

      const latest = allTrend[allTrend.length - 1]?.totalScore || 0;
      const prev = allTrend[allTrend.length - 2]?.totalScore || 0;
      const growth = Number((latest - prev).toFixed(2));
      const growthPercent = prev ? Number(((growth / prev) * 100).toFixed(1)) : 0;
      const avg = allTrend.length ? Number((allTrend.reduce((a, d) => a + d.totalScore, 0) / allTrend.length).toFixed(2)) : 0;
      setSummaryStats({
        totalScore: latest,
        avgScore: avg,
        growth,
        growthPercent
      });

      const currentMonth = months[months.length - 1];
      const lastMonth = months[months.length - 2];
      const deptMap = new Map<string, { current: number[]; last: number[] }>();

      const { data: usersData } = await supabase
        .from('users')
        .select('id, department:departments(name)')
        .limit(5000);

      const usersList = (usersData || []).map((u: any) => ({
        id: u.id,
        department: Array.isArray(u.department) ? (u.department?.[0]?.name || '-') : (u.department?.name || u.department || '-')
      })).filter(u => (userRole !== 'employee') || (u.id === user?.id));

      const computeMonthTotals = async (m: string) => {
        const { data: evalsM } = await supabase
          .from('performance_evaluations')
          .select('evaluated_user_id, total_score, status, period')
          .eq('period', m)
          .in('status', ['approved', 'submitted'])
          .limit(5000);
        const perfByUser = new Map<string, { sum: number; count: number }>();
        (evalsM || []).forEach((e: any) => {
          const uid = e.evaluated_user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const b = perfByUser.get(uid) || { sum: 0, count: 0 };
          b.sum += Number(e.total_score) || 0;
          b.count += 1;
          perfByUser.set(uid, b);
        });

        const { data: dutyM } = await supabase
          .from('scores')
          .select('user_id, score, period, score_type:score_types(category)')
          .eq('period', m)
          .limit(5000);
        const basicByUserM = new Map<string, number>();
        (dutyM || []).forEach((s: any) => {
          const uid = s.user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const category = s?.score_type?.category || '';
          if (category !== BASIC_DUTY_CATEGORY) return;
          const prev = basicByUserM.get(uid) || 0;
          const val = Number(s.score) || 0;
          basicByUserM.set(uid, prev + (val < 0 ? Math.abs(val) : 0));
        });

        const { data: rewardsM } = await supabase
          .from('reward_score_records')
          .select('user_id, score, award_period')
          .eq('award_period', m)
          .limit(5000);
        const rewardByUserM = new Map<string, number>();
        (rewardsM || []).forEach((r: any) => {
          const uid = r.user_id;
          if (!uid) return;
          if (userRole === 'employee' && uid !== user?.id) return;
          const prev = rewardByUserM.get(uid) || 0;
          rewardByUserM.set(uid, prev + (Number(r.score) || 0));
        });

        return { perfByUser, basicByUserM, rewardByUserM };
      };

      let perfCur = new Map<string, { sum: number; count: number }>(), perfPrev = new Map<string, { sum: number; count: number }>();
      let basicCur = new Map<string, number>(), basicPrev = new Map<string, number>();
      let rewardCur = new Map<string, number>(), rewardPrev = new Map<string, number>();

      if (currentMonth) {
        const res = await computeMonthTotals(currentMonth);
        perfCur = res.perfByUser;
        basicCur = res.basicByUserM;
        rewardCur = res.rewardByUserM;
      }
      if (lastMonth) {
        const res = await computeMonthTotals(lastMonth);
        perfPrev = res.perfByUser;
        basicPrev = res.basicByUserM;
        rewardPrev = res.rewardByUserM;
      }

      usersList.forEach(u => {
        const dept = u.department || '-';
        const curPerf = perfCur.get(u.id);
        const curPerfAvg = curPerf ? (curPerf.sum / Math.max(1, curPerf.count)) : 0;
        const curBasic = Math.max(0, 20 - (basicCur.get(u.id) || 0));
        const curReward = rewardCur.get(u.id) || 0;
        const curTotal = Number((curPerfAvg + curBasic + curReward).toFixed(2));

        const prevPerf = perfPrev.get(u.id);
        const prevPerfAvg = prevPerf ? (prevPerf.sum / Math.max(1, prevPerf.count)) : 0;
        const prevBasic = Math.max(0, 20 - (basicPrev.get(u.id) || 0));
        const prevReward = rewardPrev.get(u.id) || 0;
        const prevTotal = Number((prevPerfAvg + prevBasic + prevReward).toFixed(2));

        const bucket = deptMap.get(dept) || { current: [], last: [] };
        bucket.current.push(curTotal);
        bucket.last.push(prevTotal);
        deptMap.set(dept, bucket);
      });

      const deptRows: DepartmentTrend[] = Array.from(deptMap.entries()).map(([dept, vals]) => {
        const curSum = vals.current.length ? vals.current.reduce((a, v) => a + v, 0) : 0;
        const lastSum = vals.last.length ? vals.last.reduce((a, v) => a + v, 0) : 0;
        const change = Number((curSum - lastSum).toFixed(2));
        const changePercent = lastSum ? Number(((change / lastSum) * 100).toFixed(1)) : 0;
        return {
          department: dept,
          currentMonth: Number(curSum.toFixed(2)),
          lastMonth: Number(lastSum.toFixed(2)),
          change,
          changePercent
        };
      }).sort((a, b) => b.currentMonth - a.currentMonth);

      setDepartmentTrends(deptRows);
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <RiseOutlined style={{ color: '#52c41a' }} />;
    if (change < 0) return <FallOutlined style={{ color: '#ff4d4f' }} />;
    return <MinusOutlined style={{ color: '#8c8c8c' }} />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return '#52c41a';
    if (change < 0) return '#ff4d4f';
    return '#8c8c8c';
  };

  const departmentColumns: ColumnsType<DepartmentTrend> = [
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (dept) => <Tag color="blue">{dept}</Tag>
    },
    {
      title: '本月积分',
      dataIndex: 'currentMonth',
      key: 'currentMonth',
      render: (score) => (
        <span className="font-bold text-blue-600">{score}</span>
      )
    },
    {
      title: '上月积分',
      dataIndex: 'lastMonth',
      key: 'lastMonth'
    },
    {
      title: '变化',
      dataIndex: 'change',
      key: 'change',
      render: (change, record) => (
        <Space>
          {getChangeIcon(change)}
          <span style={{ color: getChangeColor(change) }}>
            {change > 0 ? '+' : ''}{change}
          </span>
          <span style={{ color: getChangeColor(change) }}>
            ({record.changePercent > 0 ? '+' : ''}{record.changePercent}%)
          </span>
        </Space>
      )
    },
    {
      title: '趋势',
      key: 'trend',
      render: (_, record) => (
        <Progress
          percent={Math.abs(record.changePercent) * 10}
          size="small"
          strokeColor={getChangeColor(record.change)}
          showInfo={false}
        />
      )
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title level={2}>
          <BarChartOutlined className="mr-2" />
          积分趋势分析
        </Title>
        <Text type="secondary">查看积分变化趋势和统计分析</Text>
      </div>

      {/* 筛选条件 */}
      <Card className="mb-6">
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <CalendarOutlined />
              <Text>时间范围：</Text>
              <Select
                value={timeRange}
                onChange={setTimeRange}
                style={{ width: 120 }}
              >
                <Select.Option value="week">最近一周</Select.Option>
                <Select.Option value="month">最近一月</Select.Option>
                <Select.Option value="quarter">最近一季度</Select.Option>
                <Select.Option value="year">最近一年</Select.Option>
                <Select.Option value="custom">自定义</Select.Option>
              </Select>
            </Space>
          </Col>
          {timeRange === 'custom' && (
            <Col>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder={['开始日期', '结束日期']}
              />
            </Col>
          )}
          <Col>
            <Button onClick={loadAnalyticsData}>刷新数据</Button>
          </Col>
        </Row>
      </Card>

      {/* 汇总统计 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总积分"
              value={summaryStats.totalScore}
              valueStyle={{ color: '#1890ff' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均积分"
              value={summaryStats.avgScore}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="环比增长"
              value={summaryStats.growth}
              valueStyle={{ color: getChangeColor(summaryStats.growth) }}
              prefix={getChangeIcon(summaryStats.growth)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="增长率"
              value={summaryStats.growthPercent}
              precision={1}
              valueStyle={{ color: getChangeColor(summaryStats.growthPercent) }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} className="mb-6">
        {/* 积分趋势图 */}
        <Col span={16}>
          <Card title="积分趋势图" loading={loading}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => dayjs(value).format('MM-DD')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => dayjs(value).format('YYYY-MM-DD')}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="totalScore" 
                  stroke="#1890ff" 
                  strokeWidth={3}
                  name="总积分"
                />
                <Line 
                  type="monotone" 
                  dataKey="basicDuty" 
                  stroke="#52c41a" 
                  name="基本职责"
                />
                <Line 
                  type="monotone" 
                  dataKey="workPerformance" 
                  stroke="#faad14" 
                  name="工作实绩"
                />
                <Line 
                  type="monotone" 
                  dataKey="keyWork" 
                  stroke="#722ed1" 
                  name="重点工作"
                />
                <Line 
                  type="monotone" 
                  dataKey="performanceReward" 
                  stroke="#eb2f96" 
                  name="绩效奖励"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 积分分布饼图 */}
        <Col span={8}>
          <Card title="积分分布" loading={loading}>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 部门对比图 */}
      <Row gutter={16} className="mb-6">
        <Col span={16}>
          <Card title="部门积分对比" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="currentMonth" fill="#1890ff" name="本月积分" />
                <Bar dataKey="lastMonth" fill="#52c41a" name="上月积分" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 部门趋势表格 */}
        <Col span={8}>
          <Card title="部门变化趋势" loading={loading}>
            <Table
              columns={departmentColumns}
              dataSource={departmentTrends}
              rowKey="department"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 积分构成面积图 */}
      <Card title="积分构成趋势" loading={loading}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => dayjs(value).format('MM-DD')}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => dayjs(value).format('YYYY-MM-DD')}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="basicDuty"
              stackId="1"
              stroke="#1890ff"
              fill="#1890ff"
              name="基本职责"
            />
            <Area
              type="monotone"
              dataKey="workPerformance"
              stackId="1"
              stroke="#52c41a"
              fill="#52c41a"
              name="工作实绩"
            />
            <Area
              type="monotone"
              dataKey="keyWork"
              stackId="1"
              stroke="#faad14"
              fill="#faad14"
              name="重点工作"
            />
            <Area
              type="monotone"
              dataKey="performanceReward"
              stackId="1"
              stroke="#722ed1"
              fill="#722ed1"
              name="绩效奖励"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Analytics;
