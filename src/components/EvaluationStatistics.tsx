import React, { useState, useEffect } from 'react';
import { Card, Table, Statistic, Row, Col, Select, DatePicker, Button, Space, Tag, Progress, Spin, Empty, Tabs } from 'antd';
import { BarChartOutlined, TrophyOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

interface EvaluationStats {
  user_id: string;
  user_name: string;
  department_name: string;
  total_tasks: number;
  completed_evaluations: number;
  avg_quantity_score: number;
  avg_quality_score: number;
  total_score: number;
  rank: number;
}

interface TaskEvaluationDetail {
  id: string;
  title: string;
  task_type: string;
  user_name: string;
  department_name: string;
  evaluation_count: number;
  avg_quantity_score: number;
  avg_quality_score: number;
  total_score: number;
  created_at: string;
}

interface DepartmentStats {
  department_name: string;
  total_tasks: number;
  avg_score: number;
  user_count: number;
}

const EvaluationStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState<EvaluationStats[]>([]);
  const [taskDetails, setTaskDetails] = useState<TaskEvaluationDetail[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month')
  ]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [dateRange, selectedDepartment]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('加载部门失败:', error);
    }
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
      const endDate = dateRange?.[1]?.format('YYYY-MM-DD');

      // 构建查询条件
      let query = supabase
        .from('work_tasks')
        .select(`
          id,
          title,
          task_type,
          user_id,
          created_at,
          user:users!work_tasks_user_id_fkey (
            id,
            name,
            department:departments!users_department_id_fkey (
              id,
              name
            )
          ),
          evaluations:performance_evaluations (
            work_quantity_score,
            work_quality_score,
            evaluator_id
          )
        `)
        .eq('status', 'approved');

      if (startDate && endDate) {
        query = query.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59');
      }

      if (selectedDepartment !== 'all') {
        query = query.eq('user.department.id', selectedDepartment);
      }

      const { data: tasksData, error } = await query;

      if (error) throw error;

      // 处理用户统计数据
      const userStatsMap = new Map<string, EvaluationStats>();
      const taskDetailsArray: TaskEvaluationDetail[] = [];
      const departmentStatsMap = new Map<string, DepartmentStats>();

      (tasksData || []).forEach(task => {
        const userId = task.user_id;
        const userName = (task.user as any)?.name || '未知用户';
        const departmentName = (task.user as any)?.department?.name || '未分配部门';
        const evaluations = task.evaluations || [];

        // 计算任务平均分
        const avgQuantityScore = evaluations.length > 0 
          ? evaluations.reduce((sum, evaluation) => sum + evaluation.work_quantity_score, 0) / evaluations.length 
          : 0;
        const avgQualityScore = evaluations.length > 0 
          ? evaluations.reduce((sum, evaluation) => sum + evaluation.work_quality_score, 0) / evaluations.length 
          : 0;
        const totalScore = avgQuantityScore + avgQualityScore;

        // 任务详情
        taskDetailsArray.push({
          id: task.id,
          title: task.title,
          task_type: task.task_type,
          user_name: userName,
          department_name: departmentName,
          evaluation_count: evaluations.length,
          avg_quantity_score: avgQuantityScore,
          avg_quality_score: avgQualityScore,
          total_score: totalScore,
          created_at: task.created_at
        });

        // 用户统计
        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            user_name: userName,
            department_name: departmentName,
            total_tasks: 0,
            completed_evaluations: 0,
            avg_quantity_score: 0,
            avg_quality_score: 0,
            total_score: 0,
            rank: 0
          });
        }

        const userStat = userStatsMap.get(userId)!;
        userStat.total_tasks += 1;
        if (evaluations.length > 0) {
          userStat.completed_evaluations += 1;
          userStat.avg_quantity_score += avgQuantityScore;
          userStat.avg_quality_score += avgQualityScore;
          userStat.total_score += totalScore;
        }

        // 部门统计
        if (!departmentStatsMap.has(departmentName)) {
          departmentStatsMap.set(departmentName, {
            department_name: departmentName,
            total_tasks: 0,
            avg_score: 0,
            user_count: new Set<string>().size
          });
        }

        const deptStat = departmentStatsMap.get(departmentName)!;
        deptStat.total_tasks += 1;
        deptStat.avg_score += totalScore;
      });

      // 计算用户平均分并排名
      const userStatsArray = Array.from(userStatsMap.values()).map(stat => {
        if (stat.completed_evaluations > 0) {
          stat.avg_quantity_score = stat.avg_quantity_score / stat.completed_evaluations;
          stat.avg_quality_score = stat.avg_quality_score / stat.completed_evaluations;
          stat.total_score = stat.total_score / stat.completed_evaluations;
        }
        return stat;
      }).sort((a, b) => b.total_score - a.total_score);

      // 设置排名
      userStatsArray.forEach((stat, index) => {
        stat.rank = index + 1;
      });

      // 计算部门平均分
      const departmentStatsArray = Array.from(departmentStatsMap.values()).map(stat => {
        if (stat.total_tasks > 0) {
          stat.avg_score = stat.avg_score / stat.total_tasks;
        }
        // 计算部门用户数
        const deptUsers = new Set(
          userStatsArray
            .filter(user => user.department_name === stat.department_name)
            .map(user => user.user_id)
        );
        stat.user_count = deptUsers.size;
        return stat;
      }).sort((a, b) => b.avg_score - a.avg_score);

      setUserStats(userStatsArray);
      setTaskDetails(taskDetailsArray.sort((a, b) => b.total_score - a.total_score));
      setDepartmentStats(departmentStatsArray);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeText = (type: string) => {
    const texts = {
      daily: '日常工作',
      project: '项目工作',
      special: '专项工作'
    };
    return texts[type as keyof typeof texts] || type;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return '#cd7f32';
    return 'default';
  };

  const userColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div className="flex items-center">
          {rank <= 3 && <TrophyOutlined style={{ color: getRankColor(rank), marginRight: 4 }} />}
          <span className={rank <= 3 ? 'font-bold' : ''}>{rank}</span>
        </div>
      )
    },
    {
      title: '姓名',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120
    },
    {
      title: '任务总数',
      dataIndex: 'total_tasks',
      key: 'total_tasks',
      width: 100,
      render: (count: number) => (
        <Tag color="blue">{count}</Tag>
      )
    },
    {
      title: '已评价任务',
      dataIndex: 'completed_evaluations',
      key: 'completed_evaluations',
      width: 120,
      render: (count: number, record: EvaluationStats) => (
        <div>
          <Tag color="green">{count}</Tag>
          <Progress 
            percent={record.total_tasks > 0 ? Math.round((count / record.total_tasks) * 100) : 0}
            size="small"
            className="mt-1"
          />
        </div>
      )
    },
    {
      title: '平均任务量得分',
      dataIndex: 'avg_quantity_score',
      key: 'avg_quantity_score',
      width: 140,
      render: (score: number) => (
        <span className="font-medium text-blue-600">
          {score.toFixed(1)} 分
        </span>
      )
    },
    {
      title: '平均质效得分',
      dataIndex: 'avg_quality_score',
      key: 'avg_quality_score',
      width: 130,
      render: (score: number) => (
        <span className="font-medium text-green-600">
          {score.toFixed(1)} 分
        </span>
      )
    },
    {
      title: '平均总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 120,
      render: (score: number) => (
        <span className="font-bold text-purple-600 text-lg">
          {score.toFixed(1)} 分
        </span>
      )
    }
  ];

  const taskColumns = [
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true
    },
    {
      title: '执行人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 100,
      render: (type: string) => getTaskTypeText(type)
    },
    {
      title: '评价人数',
      dataIndex: 'evaluation_count',
      key: 'evaluation_count',
      width: 100,
      render: (count: number) => (
        <Tag color={count > 0 ? 'green' : 'orange'}>
          {count} 人
        </Tag>
      )
    },
    {
      title: '任务量得分',
      dataIndex: 'avg_quantity_score',
      key: 'avg_quantity_score',
      width: 120,
      render: (score: number) => (
        <span className="text-blue-600">
          {score.toFixed(1)} 分
        </span>
      )
    },
    {
      title: '质效得分',
      dataIndex: 'avg_quality_score',
      key: 'avg_quality_score',
      width: 100,
      render: (score: number) => (
        <span className="text-green-600">
          {score.toFixed(1)} 分
        </span>
      )
    },
    {
      title: '总分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 100,
      render: (score: number) => (
        <span className="font-bold text-purple-600">
          {score.toFixed(1)} 分
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('MM-DD')
    }
  ];

  const departmentColumns = [
    {
      title: '部门名称',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 150
    },
    {
      title: '参与人数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (count: number) => (
        <Tag color="blue" icon={<UserOutlined />}>
          {count} 人
        </Tag>
      )
    },
    {
      title: '任务总数',
      dataIndex: 'total_tasks',
      key: 'total_tasks',
      width: 100,
      render: (count: number) => (
        <Tag color="green">{count}</Tag>
      )
    },
    {
      title: '平均得分',
      dataIndex: 'avg_score',
      key: 'avg_score',
      width: 120,
      render: (score: number) => (
        <span className="font-bold text-purple-600 text-lg">
          {score.toFixed(1)} 分
        </span>
      )
    }
  ];

  const totalTasks = taskDetails.length;
  const totalUsers = userStats.length;
  const avgScore = userStats.length > 0 
    ? userStats.reduce((sum, stat) => sum + stat.total_score, 0) / userStats.length 
    : 0;
  const topScore = userStats.length > 0 ? userStats[0].total_score : 0;

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <BarChartOutlined className="mr-2" />
              评分统计与分析
            </h2>
            <p className="text-gray-500 mt-1">
              查看工作实绩评分的统计数据和排名情况
            </p>
          </div>
          <Space>
            <Select
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              style={{ width: 150 }}
              placeholder="选择部门"
            >
              <Select.Option value="all">全部部门</Select.Option>
              {departments.map(dept => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
            />
            <Button 
              type="primary" 
              icon={<CalendarOutlined />}
              onClick={loadStatistics}
            >
              刷新数据
            </Button>
          </Space>
        </div>

        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Statistic
              title="任务总数"
              value={totalTasks}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="参与人数"
              value={totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均得分"
              value={avgScore.toFixed(1)}
              suffix="分"
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="最高得分"
              value={topScore.toFixed(1)}
              suffix="分"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
        </Row>

        <Spin spinning={loading}>
          <Tabs defaultActiveKey="users">
            <TabPane tab="个人排名" key="users">
              {userStats.length > 0 ? (
                <Table
                  columns={userColumns}
                  dataSource={userStats}
                  rowKey="user_id"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 人`
                  }}
                  scroll={{ x: 1000 }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </TabPane>
            
            <TabPane tab="任务详情" key="tasks">
              {taskDetails.length > 0 ? (
                <Table
                  columns={taskColumns}
                  dataSource={taskDetails}
                  rowKey="id"
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 个任务`
                  }}
                  scroll={{ x: 1200 }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </TabPane>
            
            <TabPane tab="部门统计" key="departments">
              {departmentStats.length > 0 ? (
                <Table
                  columns={departmentColumns}
                  dataSource={departmentStats}
                  rowKey="department_name"
                  pagination={false}
                  scroll={{ x: 600 }}
                />
              ) : (
                <Empty description="暂无数据" />
              )}
            </TabPane>
          </Tabs>
        </Spin>
      </Card>
    </div>
  );
};

export default EvaluationStatistics;