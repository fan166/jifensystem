import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tabs,
  Tag,
  Avatar,
  Space,
  Statistic,
  Progress,
  Select,
  DatePicker,
  Button,
  Typography,
  Divider
} from 'antd';
import {
  TrophyOutlined,
  CrownOutlined,
  RiseOutlined,
  TeamOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { scoreAPI, userAPI, departmentAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
// const { TabPane } = Tabs; // 已废弃，使用items属性
const { RangePicker } = DatePicker;

interface PersonalRanking {
  id: string;
  name: string;
  department: string;
  position: string;
  totalScore: number;
  basicDuty: number;
  workPerformance: number;
  keyWork: number;
  performanceReward: number;
  rank: number;
  lastMonthRank: number;
  avatar?: string;
}

interface DepartmentRanking {
  id: string;
  name: string;
  totalScore: number;
  averageScore: number;
  memberCount: number;
  rank: number;
  lastMonthRank: number;
  topPerformer: string;
}

const Ranking: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [timeRange, setTimeRange] = useState('month');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [personalRankings, setPersonalRankings] = useState<PersonalRanking[]>([]);
  const [departmentRankings, setDepartmentRankings] = useState<DepartmentRanking[]>([]);
  
  // 从Dashboard移过来的状态
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    loadRankingData();
  }, [timeRange, dateRange]);

  const loadRankingData = async () => {
    setLoading(true);
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7);
      const [rankingData, departments, users, scores] = await Promise.all([
        scoreAPI.getScoreRanking(currentPeriod),
        departmentAPI.getDepartments(),
        userAPI.getUsers(),
        scoreAPI.getScores({ period: currentPeriod })
      ]);
      
      // 设置排行榜前5名
      setTopUsers(rankingData.slice(0, 5));
      
      // 计算部门统计
      const deptStats = departments.map((dept: any) => {
        const deptUsers = users.filter((u: any) => u.department_id === dept.id);
        const deptScores = scores.filter((score: any) => 
          deptUsers.some((u: any) => u.id === score.user_id)
        );
        const totalScore = deptScores.reduce((sum: number, score: any) => sum + (score.score || 0), 0);
        
        return {
          name: dept.name,
          totalScore,
          userCount: deptUsers.length,
          avgScore: deptUsers.length > 0 ? (totalScore / deptUsers.length).toFixed(1) : '0'
        };
      }).sort((a, b) => b.totalScore - a.totalScore);
      
      setDepartmentStats(deptStats.slice(0, 5));
      
      // 计算积分类别分布
      const categoryStats = {
        '基本职责': 0,
        '工作实绩': 0,
        '重点工作': 0,
        '绩效奖励': 0
      };
      
      scores.forEach((score: any) => {
        const category = score.score_type?.category;
        if (category && categoryStats.hasOwnProperty(category)) {
          categoryStats[category as keyof typeof categoryStats] += score.score || 0;
        }
      });
      
      const pieData = Object.entries(categoryStats).map(([name, value]) => ({
        name,
        value,
        percentage: ((value / Object.values(categoryStats).reduce((a, b) => a + b, 0)) * 100).toFixed(1)
      }));
      
      setCategoryData(pieData);
      
      // 转换为个人排行榜格式
      const personalData: PersonalRanking[] = rankingData.map((item: any, index: number) => ({
        id: item.userId,
        name: item.user?.name || '未知用户',
        department: item.user?.department?.name || '未知部门',
        position: item.user?.position || '未知职位',
        totalScore: item.totalScore || 0,
        basicDuty: item.basicDuty || 0,
        workPerformance: item.workPerformance || 0,
        keyWork: item.keyWork || 0,
        performanceReward: item.bonus || 0,
        rank: index + 1,
        lastMonthRank: index + 1 // 暂时使用当前排名
      }));
      
      setPersonalRankings(personalData);
      
      // 转换为部门排行榜格式
      const departmentData: DepartmentRanking[] = deptStats.map((dept: any, index: number) => ({
        id: dept.name,
        name: dept.name,
        totalScore: dept.totalScore,
        averageScore: parseFloat(dept.avgScore),
        memberCount: dept.userCount,
        rank: index + 1,
        lastMonthRank: index + 1, // 暂时使用当前排名
        topPerformer: '待统计'
      }));
      
      setDepartmentRankings(departmentData);
      
    } catch (error) {
      console.error('加载排行榜数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <CrownOutlined style={{ color: '#FFD700' }} />;
    if (rank === 2) return <TrophyOutlined style={{ color: '#C0C0C0' }} />;
    if (rank === 3) return <TrophyOutlined style={{ color: '#CD7F32' }} />;
    return <span className="text-gray-500">#{rank}</span>;
  };

  const getRankChange = (currentRank: number, lastRank: number) => {
    const change = lastRank - currentRank;
    if (change > 0) {
      return <Tag color="green" icon={<RiseOutlined />}>↑{change}</Tag>;
    } else if (change < 0) {
      return <Tag color="red">↓{Math.abs(change)}</Tag>;
    }
    return <Tag color="default">-</Tag>;
  };

  const personalColumns: ColumnsType<PersonalRanking> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => (
        <div className="flex items-center justify-center">
          {getRankIcon(rank)}
        </div>
      )
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-sm text-gray-500">{record.position}</div>
          </div>
        </Space>
      )
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (department) => <Tag color="blue">{department}</Tag>
    },
    {
      title: '总积分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      sorter: (a, b) => a.totalScore - b.totalScore,
      render: (score) => (
        <span className="font-bold text-lg text-blue-600">{score}</span>
      )
    },
    {
      title: '基本职责',
      dataIndex: 'basicDuty',
      key: 'basicDuty',
      width: 100
    },
    {
      title: '工作实绩',
      dataIndex: 'workPerformance',
      key: 'workPerformance',
      width: 100
    },
    {
      title: '重点工作',
      dataIndex: 'keyWork',
      key: 'keyWork',
      width: 100
    },
    {
      title: '绩效奖励',
      dataIndex: 'performanceReward',
      key: 'performanceReward',
      width: 100
    },
    {
      title: '排名变化',
      key: 'rankChange',
      width: 100,
      render: (_, record) => getRankChange(record.rank, record.lastMonthRank)
    }
  ];

  const departmentColumns: ColumnsType<DepartmentRanking> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank) => (
        <div className="flex items-center justify-center">
          {getRankIcon(rank)}
        </div>
      )
    },
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <Avatar icon={<TeamOutlined />} />
          <span className="font-medium">{name}</span>
        </Space>
      )
    },
    {
      title: '总积分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      sorter: (a, b) => a.totalScore - b.totalScore,
      render: (score) => (
        <span className="font-bold text-lg text-blue-600">{score}</span>
      )
    },
    {
      title: '平均积分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      render: (score) => (
        <span className="font-medium">{score}</span>
      )
    },
    {
      title: '人员数量',
      dataIndex: 'memberCount',
      key: 'memberCount',
      render: (count) => `${count}人`
    },
    {
      title: '最佳员工',
      dataIndex: 'topPerformer',
      key: 'topPerformer',
      render: (name) => <Tag color="gold">{name}</Tag>
    },
    {
      title: '排名变化',
      key: 'rankChange',
      width: 100,
      render: (_, record) => getRankChange(record.rank, record.lastMonthRank)
    }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title level={2}>
          <TrophyOutlined className="mr-2" />
          积分排行榜
        </Title>
        <Text type="secondary">查看各部门和个人的积分排名情况</Text>
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
                <Select.Option value="week">本周</Select.Option>
                <Select.Option value="month">本月</Select.Option>
                <Select.Option value="quarter">本季度</Select.Option>
                <Select.Option value="year">本年度</Select.Option>
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
            <Button onClick={loadRankingData}>刷新数据</Button>
          </Col>
        </Row>
      </Card>

      {/* 积分排行榜概览 */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} lg={14}>
          <Card 
            title="积分排行榜概览" 
            className="shadow-lg hover:shadow-xl transition-shadow duration-300" 
            extra={<a onClick={() => setActiveTab('personal')} className="text-blue-600 hover:text-blue-800">查看详情</a>}
            bodyStyle={{ padding: '20px' }}
          >
            <div className="space-y-4">
              {topUsers.slice(0, 5).map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 border border-gray-100 hover:border-blue-200">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${
                      index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 
                      index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' : 
                      index === 2 ? 'bg-gradient-to-r from-orange-400 to-orange-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800 text-lg">{user.user?.name || '未知用户'}</div>
                      <div className="text-sm text-gray-600">{user.user?.department?.name || '未知部门'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600 text-xl">{user.totalScore}分</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card 
            title="积分类别分布" 
            className="shadow-lg hover:shadow-xl transition-shadow duration-300"
            bodyStyle={{ padding: '20px' }}
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 排行榜内容 */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'personal',
              label: (
                <span>
                  <UserOutlined />
                  个人排行榜
                </span>
              ),
              children: (
                <>
                  {/* 前三名展示 */}
                  <Row gutter={16} className="mb-6">
                    {personalRankings.slice(0, 3).map((person, index) => (
                      <Col span={8} key={person.id}>
                        <Card className="text-center">
                          <div className="mb-4">
                            {getRankIcon(person.rank)}
                          </div>
                          <Avatar size={64} icon={<UserOutlined />} className="mb-2" />
                          <Title level={4} className="mb-1">{person.name}</Title>
                          <Text type="secondary">{person.department}</Text>
                          <Divider />
                          <Statistic
                            title="总积分"
                            value={person.totalScore}
                            valueStyle={{ color: '#1890ff' }}
                          />
                          <div className="mt-2">
                            {getRankChange(person.rank, person.lastMonthRank)}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>

                  <Table
                    columns={personalColumns}
                    dataSource={personalRankings}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                  />
                </>
              )
            },
            {
              key: 'department',
              label: (
                <span>
                  <TeamOutlined />
                  部门排行榜
                </span>
              ),
              children: (
                <>
                  {/* 前三名部门展示 */}
                  <Row gutter={16} className="mb-6">
                    {departmentRankings.slice(0, 3).map((dept) => (
                      <Col span={8} key={dept.id}>
                        <Card className="text-center">
                          <div className="mb-4">
                            {getRankIcon(dept.rank)}
                          </div>
                          <Avatar size={64} icon={<TeamOutlined />} className="mb-2" />
                          <Title level={4} className="mb-1">{dept.name}</Title>
                          <Text type="secondary">最佳员工：{dept.topPerformer}</Text>
                          <Divider />
                          <Row gutter={16}>
                            <Col span={12}>
                              <Statistic
                                title="总积分"
                                value={dept.totalScore}
                                valueStyle={{ color: '#1890ff' }}
                              />
                            </Col>
                            <Col span={12}>
                              <Statistic
                                title="平均积分"
                                value={dept.averageScore}
                                valueStyle={{ color: '#52c41a' }}
                              />
                            </Col>
                          </Row>
                          <div className="mt-2">
                            {getRankChange(dept.rank, dept.lastMonthRank)}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>

                  <Table
                    columns={departmentColumns}
                    dataSource={departmentRankings}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                  />
                </>
              )
            }
          ]}
        />
      </Card>

      {/* 部门积分统计 */}
      <Row gutter={[24, 24]} className="mt-8">
        <Col xs={24}>
          <Card 
            title="部门积分统计" 
            className="shadow-lg hover:shadow-xl transition-shadow duration-300" 
            extra={<a onClick={() => setActiveTab('department')} className="text-blue-600 hover:text-blue-800">查看详情</a>}
            bodyStyle={{ padding: '20px' }}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="totalScore" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
      

    </div>
  );
};

export default Ranking;