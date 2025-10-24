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

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // 模拟趋势数据
      const mockTrendData: TrendData[] = [
        {
          date: '2024-01-01',
          totalScore: 2450,
          basicDuty: 850,
          workPerformance: 720,
          keyWork: 580,
          performanceReward: 300
        },
        {
          date: '2024-01-08',
          totalScore: 2580,
          basicDuty: 880,
          workPerformance: 750,
          keyWork: 620,
          performanceReward: 330
        },
        {
          date: '2024-01-15',
          totalScore: 2720,
          basicDuty: 920,
          workPerformance: 780,
          keyWork: 650,
          performanceReward: 370
        },
        {
          date: '2024-01-22',
          totalScore: 2650,
          basicDuty: 900,
          workPerformance: 760,
          keyWork: 630,
          performanceReward: 360
        },
        {
          date: '2024-01-29',
          totalScore: 2850,
          basicDuty: 950,
          workPerformance: 820,
          keyWork: 680,
          performanceReward: 400
        }
      ];

      // 模拟分类数据
      const mockCategoryData: CategoryData[] = [
        { name: '基本职责', value: 950, color: '#1890ff' },
        { name: '工作实绩', value: 820, color: '#52c41a' },
        { name: '重点工作', value: 680, color: '#faad14' },
        { name: '绩效奖励', value: 400, color: '#722ed1' }
      ];

      // 模拟部门趋势数据
      const mockDepartmentTrends: DepartmentTrend[] = [
        {
          department: '技术部',
          currentMonth: 2850,
          lastMonth: 2720,
          change: 130,
          changePercent: 4.8
        },
        {
          department: '市场部',
          currentMonth: 2720,
          lastMonth: 2850,
          change: -130,
          changePercent: -4.6
        },
        {
          department: '人事部',
          currentMonth: 2180,
          lastMonth: 2100,
          change: 80,
          changePercent: 3.8
        },
        {
          department: '财务部',
          currentMonth: 2050,
          lastMonth: 2080,
          change: -30,
          changePercent: -1.4
        }
      ];

      // 计算汇总统计
      const totalScore = mockTrendData[mockTrendData.length - 1].totalScore;
      const lastScore = mockTrendData[mockTrendData.length - 2].totalScore;
      const growth = totalScore - lastScore;
      const growthPercent = ((growth / lastScore) * 100);

      setTrendData(mockTrendData);
      setCategoryData(mockCategoryData);
      setDepartmentTrends(mockDepartmentTrends);
      setSummaryStats({
        totalScore,
        avgScore: Math.round(totalScore / 4), // 假设4个部门
        growth,
        growthPercent: Number(growthPercent.toFixed(1))
      });
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