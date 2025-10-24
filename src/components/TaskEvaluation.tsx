import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Rate, Space, message, Tag, Row, Col, Spin, Progress, Statistic } from 'antd';
import { StarOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface WorkTask {
  id: string;
  title: string;
  description: string;
  task_type: 'daily' | 'project' | 'special';
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  start_date: string;
  end_date: string;
  work_load: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  user?: {
    id: string;
    name: string;
    department?: {
      name: string;
    };
  };
  evaluations?: PerformanceEvaluation[];
  my_evaluation?: PerformanceEvaluation;
  evaluation_stats?: {
    total_evaluators: number;
    completed_evaluations: number;
    avg_quantity_score: number;
    avg_quality_score: number;
  };
}

interface PerformanceEvaluation {
  id: string;
  task_id: string;
  evaluator_id: string;
  evaluated_id: string;
  work_quantity_score: number;
  work_quality_score: number;
  comments: string;
  evaluation_period: string;
  created_at: string;
  evaluator?: {
    name: string;
  };
}

const TaskEvaluation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [evaluatingTask, setEvaluatingTask] = useState<WorkTask | null>(null);
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'to_evaluate' | 'completed'>('to_evaluate');

  useEffect(() => {
    loadTasks();
  }, [activeTab]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      // 获取已审核通过的任务
      const { data: tasksData, error: tasksError } = await supabase
        .from('work_tasks')
        .select(`
          *,
          user:users!work_tasks_user_id_fkey (
            id,
            name,
            department:departments!users_department_id_fkey (
              name
            )
          )
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // 获取评价数据
      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('performance_evaluations')
        .select(`
          *,
          evaluator:users!performance_evaluations_evaluator_id_fkey (
            name
          )
        `);

      if (evaluationsError) throw evaluationsError;

      // 组合数据
      const tasksWithEvaluations = (tasksData || []).map(task => {
        const taskEvaluations = evaluationsData?.filter(evaluation => evaluation.task_id === task.id) || [];
        const myEvaluation = taskEvaluations.find(evaluation => evaluation.evaluator_id === user?.id);
        
        // 计算评价统计
        const evaluation_stats = {
          total_evaluators: taskEvaluations.length,
          completed_evaluations: taskEvaluations.length,
          avg_quantity_score: taskEvaluations.length > 0 
            ? taskEvaluations.reduce((sum, evaluation) => sum + evaluation.work_quantity_score, 0) / taskEvaluations.length 
            : 0,
          avg_quality_score: taskEvaluations.length > 0 
            ? taskEvaluations.reduce((sum, evaluation) => sum + evaluation.work_quality_score, 0) / taskEvaluations.length 
            : 0
        };

        return {
          ...task,
          evaluations: taskEvaluations,
          my_evaluation: myEvaluation,
          evaluation_stats
        };
      });

      // 根据当前标签页过滤任务
      const filteredTasks = tasksWithEvaluations.filter(task => {
        if (activeTab === 'to_evaluate') {
          return !task.my_evaluation; // 未评价的任务
        } else {
          return task.my_evaluation; // 已评价的任务
        }
      });

      setTasks(filteredTasks);
    } catch (error) {
      console.error('加载任务失败:', error);
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = (task: WorkTask) => {
    setEvaluatingTask(task);
    form.resetFields();
    form.setFieldsValue({
      work_quantity_score: 25, // 默认分数
      work_quality_score: 15,
      comments: ''
    });
    setIsModalVisible(true);
  };

  const handleSubmitEvaluation = async (values: any) => {
    if (!evaluatingTask) return;

    try {
      const evaluationData = {
        task_id: evaluatingTask.id,
        evaluator_id: user?.id,
        evaluated_id: evaluatingTask.user_id,
        work_quantity_score: values.work_quantity_score,
        work_quality_score: values.work_quality_score,
        comments: values.comments || '',
        evaluation_period: dayjs().format('YYYY-MM')
      };

      const { error } = await supabase
        .from('performance_evaluations')
        .insert([evaluationData]);

      if (error) throw error;

      message.success('评价提交成功');
      setIsModalVisible(false);
      loadTasks();
    } catch (error) {
      console.error('提交评价失败:', error);
      message.error('提交评价失败');
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

  const getPriorityText = (priority: string) => {
    const texts = {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急'
    };
    return texts[priority as keyof typeof texts] || priority;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'default',
      normal: 'blue',
      high: 'orange',
      urgent: 'red'
    };
    return colors[priority as keyof typeof colors] || 'default';
  };

  const columns = [
    {
      title: '任务执行人',
      dataIndex: ['user', 'name'],
      key: 'userName',
      width: 120,
      render: (name: string, record: WorkTask) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-gray-500">
            {record.user?.department?.name}
          </div>
        </div>
      )
    },
    {
      title: '任务标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true
    },
    {
      title: '任务类型',
      dataIndex: 'task_type',
      key: 'task_type',
      width: 100,
      render: (type: string) => getTaskTypeText(type)
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>
          {getPriorityText(priority)}
        </Tag>
      )
    },
    {
      title: '工作量',
      dataIndex: 'work_load',
      key: 'work_load',
      width: 80,
      render: (load: number) => `${load}天`
    },
    {
      title: '评价进度',
      key: 'evaluation_progress',
      width: 120,
      render: (_, record: WorkTask) => {
        const stats = record.evaluation_stats;
        if (!stats) return '-';
        
        const progress = stats.total_evaluators > 0 
          ? (stats.completed_evaluations / Math.max(stats.total_evaluators, 1)) * 100 
          : 0;
        
        return (
          <div>
            <Progress 
              percent={Math.round(progress)} 
              size="small" 
              status={progress === 100 ? 'success' : 'active'}
            />
            <div className="text-xs text-gray-500 mt-1">
              {stats.completed_evaluations} 人已评价
            </div>
          </div>
        );
      }
    },
    {
      title: '当前评分',
      key: 'current_scores',
      width: 120,
      render: (_, record: WorkTask) => {
        const stats = record.evaluation_stats;
        if (!stats || stats.completed_evaluations === 0) {
          return <span className="text-gray-400">暂无评分</span>;
        }
        
        const totalScore = stats.avg_quantity_score + stats.avg_quality_score;
        
        return (
          <div>
            <div className="font-medium text-blue-600">
              {totalScore.toFixed(1)} 分
            </div>
            <div className="text-xs text-gray-500">
              任务量: {stats.avg_quantity_score.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">
              质效: {stats.avg_quality_score.toFixed(1)}
            </div>
          </div>
        );
      }
    },
    {
      title: '我的评价',
      key: 'my_evaluation_status',
      width: 100,
      render: (_, record: WorkTask) => {
        if (record.my_evaluation) {
          const total = record.my_evaluation.work_quantity_score + record.my_evaluation.work_quality_score;
          return (
            <div>
              <Tag color="green" icon={<CheckOutlined />}>
                已评价
              </Tag>
              <div className="text-xs text-gray-600 mt-1">
                {total.toFixed(1)} 分
              </div>
            </div>
          );
        }
        return (
          <Tag color="orange">
            待评价
          </Tag>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: WorkTask) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              Modal.info({
                title: '任务详情',
                content: (
                  <div>
                    <p><strong>执行人：</strong>{record.user?.name} ({record.user?.department?.name})</p>
                    <p><strong>任务标题：</strong>{record.title}</p>
                    <p><strong>任务描述：</strong>{record.description || '无'}</p>
                    <p><strong>任务类型：</strong>{getTaskTypeText(record.task_type)}</p>
                    <p><strong>优先级：</strong>{getPriorityText(record.priority)}</p>
                    <p><strong>工作量：</strong>{record.work_load}天</p>
                    <p><strong>计划时间：</strong>
                      {record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '未设置'} 至 
                      {record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '未设置'}
                    </p>
                    {record.my_evaluation && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <p><strong>我的评价：</strong></p>
                        <p>工作任务量评分：{record.my_evaluation.work_quantity_score} 分</p>
                        <p>工作完成质效评分：{record.my_evaluation.work_quality_score} 分</p>
                        <p>评价意见：{record.my_evaluation.comments || '无'}</p>
                      </div>
                    )}
                  </div>
                ),
                width: 600
              });
            }}
          >
            查看
          </Button>
          {!record.my_evaluation && (
            <Button
              type="primary"
              size="small"
              icon={<StarOutlined />}
              onClick={() => handleEvaluate(record)}
            >
              评价
            </Button>
          )}
        </Space>
      )
    }
  ];

  const toEvaluateCount = tasks.filter(task => !task.my_evaluation).length;
  const completedCount = tasks.filter(task => task.my_evaluation).length;

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">集体评分</h2>
            <p className="text-gray-500 mt-1">
              对已审核通过的工作任务进行集体评分，评价工作任务量和完成质效
            </p>
          </div>
          <div className="flex space-x-4">
            <Statistic
              title="待评价任务"
              value={toEvaluateCount}
              valueStyle={{ color: '#fa8c16' }}
            />
            <Statistic
              title="已评价任务"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </div>
        </div>

        <div className="mb-4">
          <Space>
            <Button
              type={activeTab === 'to_evaluate' ? 'primary' : 'default'}
              onClick={() => setActiveTab('to_evaluate')}
            >
              待评价任务 ({toEvaluateCount})
            </Button>
            <Button
              type={activeTab === 'completed' ? 'primary' : 'default'}
              onClick={() => setActiveTab('completed')}
            >
              已评价任务 ({completedCount})
            </Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条任务`
            }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>

      <Modal
        title="任务评价"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={600}
      >
        {evaluatingTask && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h4 className="font-medium mb-2">{evaluatingTask.title}</h4>
            <p className="text-sm text-gray-600 mb-2">
              执行人：{evaluatingTask.user?.name} ({evaluatingTask.user?.department?.name})
            </p>
            <p className="text-sm text-gray-600 mb-2">
              工作量：{evaluatingTask.work_load}天 | 类型：{getTaskTypeText(evaluatingTask.task_type)}
            </p>
            <p className="text-sm text-gray-600">
              {evaluatingTask.description}
            </p>
          </div>
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitEvaluation}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="work_quantity_score"
                label="工作任务量评分（0-30分）"
                rules={[{ required: true, message: '请评分' }]}
              >
                <div>
                  <Rate
                    count={6}
                    value={form.getFieldValue('work_quantity_score') / 5}
                    onChange={(value) => form.setFieldsValue({ work_quantity_score: value * 5 })}
                    allowHalf
                  />
                  <div className="mt-2">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={form.getFieldValue('work_quantity_score')}
                      onChange={(e) => form.setFieldsValue({ work_quantity_score: parseFloat(e.target.value) || 0 })}
                      addonAfter="分"
                    />
                  </div>
                </div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="work_quality_score"
                label="工作完成质效评分（0-20分）"
                rules={[{ required: true, message: '请评分' }]}
              >
                <div>
                  <Rate
                    count={4}
                    value={form.getFieldValue('work_quality_score') / 5}
                    onChange={(value) => form.setFieldsValue({ work_quality_score: value * 5 })}
                    allowHalf
                  />
                  <div className="mt-2">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      step={0.5}
                      value={form.getFieldValue('work_quality_score')}
                      onChange={(e) => form.setFieldsValue({ work_quality_score: parseFloat(e.target.value) || 0 })}
                      addonAfter="分"
                    />
                  </div>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="comments"
            label="评价意见（可选）"
          >
            <TextArea
              rows={4}
              placeholder="请输入对该任务完成情况的评价意见..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <div className="mb-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-600">
              <strong>评分说明：</strong>
            </p>
            <p className="text-xs text-blue-500 mt-1">
              • 工作任务量（0-30分）：根据任务的复杂程度、工作量大小进行评分
            </p>
            <p className="text-xs text-blue-500">
              • 工作完成质效（0-20分）：根据任务完成的质量和效率进行评分
            </p>
          </div>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                提交评价
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskEvaluation;