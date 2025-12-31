import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, DatePicker, Spin, Progress, Tag, Tooltip, Space, Button, Modal } from 'antd';
import { TrophyOutlined, UserOutlined, CalendarOutlined, BarChartOutlined, EyeOutlined, DownloadOutlined, BulbOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { scoreAPI, userAPI } from '../services/api';
import type { Score, User } from '../lib/supabase';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface ScoreRecord extends Score {
  user?: { name: string; email: string; department?: { name: string } };
  recorder?: { name: string };
}

interface UserStats {
  userId: string;
  userName: string;
  departmentName: string;
  attendanceScore: number;
  learningScore: number;
  disciplineScore: number;
  totalScore: number;
  recordCount: number;
  rank: number;
}

interface DepartmentStats {
  departmentName: string;
  userCount: number;
  avgScore: number;
  totalScore: number;
  attendanceAvg: number;
  learningAvg: number;
  disciplineAvg: number;
}

interface BasicDutyStatsProps {
  currentUserId?: string; // 当前用户ID，用于权限控制
}

const BasicDutyStats: React.FC<BasicDutyStatsProps> = ({ currentUserId }) => {
  const [loading, setLoading] = useState(false);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>(undefined);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedUserRecords, setSelectedUserRecords] = useState<ScoreRecord[]>([]);
  const [selectedUserName, setSelectedUserName] = useState('');

  // 总体统计数据
  const [overallStats, setOverallStats] = useState({
    totalUsers: 0,
    totalRecords: 0,
    avgScore: 0,
    bestPerformer: '',
    worstPerformer: '',
    attendanceTotal: 0,
    learningTotal: 0,
    disciplineTotal: 0
  });

  useEffect(() => {
    loadData();
  }, [dateRange, selectedDepartment]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData] = await Promise.all([
        userAPI.getUsers()
      ]);
      setUsers(usersData);

      // 构建查询条件
      const filters: any = { category: 'basic_duty' };
      if (dateRange) {
        filters.startDate = dateRange[0].format('YYYY-MM-DD');
        filters.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      // 如果是普通职工，只查询自己的记录
      if (currentUserId) {
        filters.userId = currentUserId;
      }

      const scoresData = await scoreAPI.getScores(filters);
      // 只显示基本职责相关的记录（兼容中文与英文类型命名）
      const basicDutyRecords = scoresData.filter(record => {
        const type = record.score_type_id || '';
        return (
          (record as any).category === 'basic_duty' ||
          /考勤|学习|培训|纪律|违纪|attendance|learning|training|discipline|violation/i.test(type)
        );
      });
      
      setScoreRecords(basicDutyRecords);
      calculateStats(basicDutyRecords, usersData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: ScoreRecord[], allUsers: User[]) => {
    // 按用户分组统计
    const userStatsMap = new Map<string, UserStats>();
    const departmentStatsMap = new Map<string, DepartmentStats>();

    // 初始化用户统计
    allUsers.forEach(user => {
      if (!selectedDepartment || user.department_id === selectedDepartment) {
        userStatsMap.set(user.id, {
          userId: user.id,
          userName: user.name,
          departmentName: user.department?.name || '未分配',
          attendanceScore: 0,
          learningScore: 0,
          disciplineScore: 0,
          totalScore: 0,
          recordCount: 0,
          rank: 0
        });
      }
    });

    // 统计扣分记录（按类型累计扣分），总分按 20 − 扣分合计 计算
    records.forEach(record => {
      if (!record.user_id || !userStatsMap.has(record.user_id)) return;
      
      const userStat = userStatsMap.get(record.user_id)!;
      userStat.recordCount++;
      const typeName = record.score_type_id || '';
      const deduction = record.score < 0 ? Math.abs(record.score) : 0;

      // 按类型分类统计（累计扣分为正数）
      if (/考勤|attendance/i.test(typeName)) {
        userStat.attendanceScore += deduction;
      } else if (/学习|培训|learning|training/i.test(typeName)) {
        userStat.learningScore += deduction;
      } else if (/纪律|违纪|discipline|violation/i.test(typeName)) {
        userStat.disciplineScore += deduction;
      }
    });

    // 计算每位用户的总分：20 − 三类扣分合计
    const userStatsArray = Array.from(userStatsMap.values())
      .map(stat => ({
        ...stat,
        totalScore: Number((20 - (stat.attendanceScore + stat.learningScore + stat.disciplineScore)).toFixed(1))
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((stat, index) => ({ ...stat, rank: index + 1 }));

    setUserStats(userStatsArray);

    // 按部门统计
    userStatsArray.forEach(userStat => {
      const deptName = userStat.departmentName;
      if (!departmentStatsMap.has(deptName)) {
        departmentStatsMap.set(deptName, {
          departmentName: deptName,
          userCount: 0,
          avgScore: 0,
          totalScore: 0,
          attendanceAvg: 0,
          learningAvg: 0,
          disciplineAvg: 0
        });
      }
      
      const deptStat = departmentStatsMap.get(deptName)!;
      deptStat.userCount++;
      deptStat.totalScore += userStat.totalScore;
      deptStat.attendanceAvg += userStat.attendanceScore;
      deptStat.learningAvg += userStat.learningScore;
      deptStat.disciplineAvg += userStat.disciplineScore;
    });

    // 计算部门平均值
    const departmentStatsArray = Array.from(departmentStatsMap.values()).map(dept => ({
      ...dept,
      avgScore: dept.userCount > 0 ? Number((dept.totalScore / dept.userCount).toFixed(1)) : 0,
      attendanceAvg: dept.userCount > 0 ? Number((dept.attendanceAvg / dept.userCount).toFixed(1)) : 0,
      learningAvg: dept.userCount > 0 ? Number((dept.learningAvg / dept.userCount).toFixed(1)) : 0,
      disciplineAvg: dept.userCount > 0 ? Number((dept.disciplineAvg / dept.userCount).toFixed(1)) : 0
    })).sort((a, b) => b.avgScore - a.avgScore);

    setDepartmentStats(departmentStatsArray);

    // 计算总体统计
    const totalUsers = userStatsArray.length;
    const totalRecords = records.length;
    const avgScore = totalUsers > 0 ? Number((userStatsArray.reduce((sum, stat) => sum + stat.totalScore, 0) / totalUsers).toFixed(1)) : 0;
    const bestPerformer = userStatsArray.length > 0 ? userStatsArray[0].userName : '';
    const worstPerformer = userStatsArray.length > 0 ? userStatsArray[userStatsArray.length - 1].userName : '';
    
    const attendanceTotal = userStatsArray.reduce((sum, u) => sum + u.attendanceScore, 0);
    const learningTotal = userStatsArray.reduce((sum, u) => sum + u.learningScore, 0);
    const disciplineTotal = userStatsArray.reduce((sum, u) => sum + u.disciplineScore, 0);



    setOverallStats({
      totalUsers,
      totalRecords,
      avgScore,
      bestPerformer,
      worstPerformer,
      attendanceTotal: Number(attendanceTotal.toFixed(1)),
      learningTotal: Number(learningTotal.toFixed(1)),
      disciplineTotal: Number(disciplineTotal.toFixed(1))
    });
  };

  const handleViewUserDetail = async (userId: string, userName: string) => {
    setSelectedUserName(userName);
    
    // 获取用户详细记录
    const filters: any = { 
      category: 'basic_duty',
      userId: userId
    };
    if (dateRange) {
      filters.startDate = dateRange[0].format('YYYY-MM-DD');
      filters.endDate = dateRange[1].format('YYYY-MM-DD');
    }

    try {
      const userRecords = await scoreAPI.getScores(filters);
      const basicDutyRecords = userRecords.filter(record => 
        record.score_type_id?.includes('attendance') ||
        record.score_type_id?.includes('learning') ||
        record.score_type_id?.includes('discipline') ||
        record.score_type_id?.includes('training') ||
        record.score_type_id?.includes('violation')
      );
      setSelectedUserRecords(basicDutyRecords);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取用户详细记录失败:', error);
    }
  };

  const handleExportStats = () => {
    const exportData = userStats.map(stat => ({
      '排名': stat.rank,
      '姓名': stat.userName,
      '部门': stat.departmentName,
      '考勤管理': stat.attendanceScore,
      '基础学习': stat.learningScore,
      '工作纪律': stat.disciplineScore,
      '总分': stat.totalScore,
      '记录数': stat.recordCount
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '基本职责积分统计');
    
    const fileName = `基本职责积分统计_${dateRange ? dateRange[0].format('YYYY-MM-DD') + '至' + dateRange[1].format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const userColumns: ColumnsType<UserStats> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (rank) => (
        <Tag color={rank <= 3 ? 'gold' : rank <= 10 ? 'blue' : 'default'}>
          {rank}
        </Tag>
      )
    },
    {
      title: '姓名',
      dataIndex: 'userName',
      key: 'userName',
      width: 100
    },
    
    {
      title: '考勤管理',
      dataIndex: 'attendanceScore',
      key: 'attendanceScore',
      width: 90,
      render: (score) => (
        <Tag color={'red'}>
          {score}
        </Tag>
      ),
      sorter: (a, b) => a.attendanceScore - b.attendanceScore
    },
    {
      title: '基础学习',
      dataIndex: 'learningScore',
      key: 'learningScore',
      width: 90,
      render: (score) => (
        <Tag color={'red'}>
          {score}
        </Tag>
      ),
      sorter: (a, b) => a.learningScore - b.learningScore
    },
    {
      title: '工作纪律',
      dataIndex: 'disciplineScore',
      key: 'disciplineScore',
      width: 90,
      render: (score) => (
        <Tag color={'red'}>
          {score}
        </Tag>
      ),
      sorter: (a, b) => a.disciplineScore - b.disciplineScore
    },
    {
      title: '总分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 90,
      render: (score) => (
        <Tag color={score >= 0 ? 'green' : 'red'} className="font-bold">
          {score > 0 ? '+' : ''}{score}
        </Tag>
      ),
      sorter: (a, b) => a.totalScore - b.totalScore
    },
    {
      title: '记录数',
      dataIndex: 'recordCount',
      key: 'recordCount',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewUserDetail(record.userId, record.userName)}
        >
          详情
        </Button>
      )
    }
  ];

  const departmentColumns: ColumnsType<DepartmentStats> = [
    {
      title: '部门',
      dataIndex: 'departmentName',
      key: 'departmentName',
      width: 120
    },
    {
      title: '人数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 80
    },
    {
      title: '平均积分',
      dataIndex: 'avgScore',
      key: 'avgScore',
      width: 90,
      render: (score) => (
        <Tag color={score >= 0 ? 'green' : 'red'} className="font-bold">
          {score > 0 ? '+' : ''}{score}
        </Tag>
      ),
      sorter: (a, b) => a.avgScore - b.avgScore
    },
    {
      title: '考勤平均',
      dataIndex: 'attendanceAvg',
      key: 'attendanceAvg',
      width: 90,
      render: (score) => (
        <Tag color={score >= 0 ? 'green' : 'red'}>
          {score > 0 ? '+' : ''}{score}
        </Tag>
      )
    },
    {
      title: '学习平均',
      dataIndex: 'learningAvg',
      key: 'learningAvg',
      width: 90,
      render: (score) => (
        <Tag color={score >= 0 ? 'green' : 'red'}>
          {score > 0 ? '+' : ''}{score}
        </Tag>
      )
    },
    {
      title: '纪律平均',
      dataIndex: 'disciplineAvg',
      key: 'disciplineAvg',
      width: 90,
      render: (score) => (
        <Tag color={score >= 0 ? 'green' : 'red'}>
          {score > 0 ? '+' : ''}{score}
        </Tag>
      )
    }
  ];

  const detailColumns: ColumnsType<ScoreRecord> = [
    {
      title: '日期',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date) => dayjs(date).format('MM-DD')
    },
    {
      title: '类型',
      dataIndex: 'score_type_id',
      key: 'scoreType',
      width: 100,
      render: (typeId) => {
        let color = 'blue';
        if (typeId?.includes('attendance')) color = 'orange';
        else if (typeId?.includes('learning') || typeId?.includes('training')) color = 'green';
        else if (typeId?.includes('discipline') || typeId?.includes('violation')) color = 'red';
        return <Tag color={color}>{typeId}</Tag>;
      }
    },
    {
      title: '积分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (value) => (
        <Tag color={Number(value) > 0 ? 'green' : 'red'}>
          {Number(value) > 0 ? '+' : ''}{value}
        </Tag>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      )
    },
    {
      title: '录入人',
      dataIndex: ['recorder', 'name'],
      key: 'recorder',
      width: 80
    }
  ];

  const departments = Array.from(new Set(users.map(u => u.department_id).filter(Boolean)));

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {/* 总体统计卡片 */}
      <Row gutter={24} className="mb-4">
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic title="扣分记录数" value={overallStats.totalRecords} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic title="考勤管理扣分" value={overallStats.attendanceTotal} precision={1} suffix="分" valueStyle={{ color: '#1f1f1f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic title="基础学习扣分" value={overallStats.learningTotal} precision={1} suffix="分" valueStyle={{ color: '#1f1f1f' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic title="工作纪律扣分" value={overallStats.disciplineTotal} precision={1} suffix="分" valueStyle={{ color: '#1f1f1f' }} />
          </Card>
        </Col>
      </Row>

      

     

      {/* 个人积分排行榜 - 仅管理员可见 */}
      {!currentUserId && (
        <Card className="mb-4" title="个人积分排行榜">
          <Spin spinning={loading}>
            <Table
              columns={userColumns}
              dataSource={userStats}
              rowKey="userId"
              pagination={{ 
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
              }}
              scroll={{ x: 800 }}
            />
          </Spin>
        </Card>
      )}

      {/* 部门积分统计 - 仅管理员可见 */}
      {!currentUserId && (
        <Card title="部门积分统计">
          <Spin spinning={loading}>
            <Table
              columns={departmentColumns}
              dataSource={departmentStats}
              rowKey="departmentName"
              pagination={false}
              scroll={{ x: 600 }}
            />
          </Spin>
        </Card>
      )}

      {/* 个人积分详情 - 仅普通职工可见 */}
      {currentUserId && (
        <Card title="我的基本职责积分详情">
          <Table
            columns={[
              {
                title: '日期',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (date: string) => new Date(date).toLocaleDateString()
              },
              {
                title: '考勤管理分',
                key: 'attendance_score',
                render: (_, record: any) => {
                  if (/考勤|attendance/i.test(record.score_type_id || '')) {
                    return (
                      <span style={{ color: '#ff4d4f' }}>
                        {Math.abs(record.score)}
                      </span>
                    );
                  }
                  return '-';
                }
              },
              {
                title: '基础学习分',
                key: 'learning_score',
                render: (_, record: any) => {
                  if (/学习|培训|learning|training/i.test(record.score_type_id || '')) {
                    return (
                      <span style={{ color: '#ff4d4f' }}>
                        {Math.abs(record.score)}
                      </span>
                    );
                  }
                  return '-';
                }
              },
              {
                title: '工作纪律分',
                key: 'discipline_score',
                render: (_, record: any) => {
                  if (/纪律|违纪|discipline|violation/i.test(record.score_type_id || '')) {
                    return (
                      <span style={{ color: '#ff4d4f' }}>
                        {Math.abs(record.score)}
                      </span>
                    );
                  }
                  return '-';
                }
              },
              {
                title: '积分值',
                dataIndex: 'score',
                key: 'score',
                render: (score: number) => (
                  <span style={{ color: score >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                )
              },
              {
                title: '说明',
                dataIndex: 'reason',
                key: 'reason'
              }
            ]}
            dataSource={scoreRecords.filter(record => record.user_id === currentUserId)}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            loading={loading}
          />
        </Card>
      )}

      {/* 用户详情模态框 */}
      <Modal
        title={`${selectedUserName} - 基本职责积分详情`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={detailColumns}
          dataSource={selectedUserRecords}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 600 }}
        />
      </Modal>
    </div>
  );
};

export default BasicDutyStats;
