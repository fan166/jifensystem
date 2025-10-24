import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Tag, Row, Col, Spin, Popconfirm } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { Option } = Select;
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
}

const TaskReview: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [reviewingTask, setReviewingTask] = useState<WorkTask | null>(null);
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadTasks();
  }, [statusFilter]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
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
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('加载任务失败:', error);
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (task: WorkTask, action: 'approve' | 'reject') => {
    setReviewingTask(task);
    form.resetFields();
    form.setFieldsValue({
      action,
      review_comments: ''
    });
    setIsModalVisible(true);
  };

  const handleSubmitReview = async (values: any) => {
    if (!reviewingTask) return;

    try {
      const newStatus = values.action === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('work_tasks')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewingTask.id);

      if (error) throw error;

      // 如果需要记录审核意见，可以在这里添加到审核记录表
      // 目前先用 message 显示
      if (values.review_comments) {
        console.log('审核意见:', values.review_comments);
      }

      message.success(`任务${values.action === 'approve' ? '审核通过' : '已拒绝'}`);
      setIsModalVisible(false);
      loadTasks();
    } catch (error) {
      console.error('审核失败:', error);
      message.error('审核失败');
    }
  };

  const handleBatchApprove = async () => {
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    if (pendingTasks.length === 0) {
      message.info('没有待审核的任务');
      return;
    }

    try {
      const { error } = await supabase
        .from('work_tasks')
        .update({ status: 'approved' })
        .eq('status', 'pending');

      if (error) throw error;

      message.success(`批量审核通过 ${pendingTasks.length} 个任务`);
      loadTasks();
    } catch (error) {
      console.error('批量审核失败:', error);
      message.error('批量审核失败');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'orange',
      approved: 'green',
      in_progress: 'blue',
      completed: 'success',
      rejected: 'red'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts = {
      pending: '待审核',
      approved: '已通过',
      in_progress: '进行中',
      completed: '已完成',
      rejected: '已拒绝'
    };
    return texts[status as keyof typeof texts] || status;
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
      title: '提交人',
      dataIndex: ['user', 'name'],
      key: 'userName',
      width: 100,
      render: (name: string, record: WorkTask) => (
        <div>
          <div>{name}</div>
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
      title: '计划时间',
      key: 'duration',
      width: 150,
      render: (_, record: WorkTask) => (
        <div className="text-sm">
          <div>{record.start_date ? dayjs(record.start_date).format('MM-DD') : '-'}</div>
          <div className="text-gray-500">
            至 {record.end_date ? dayjs(record.end_date).format('MM-DD') : '-'}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
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
                    <p><strong>提交人：</strong>{record.user?.name} ({record.user?.department?.name})</p>
                    <p><strong>任务标题：</strong>{record.title}</p>
                    <p><strong>任务描述：</strong>{record.description || '无'}</p>
                    <p><strong>任务类型：</strong>{getTaskTypeText(record.task_type)}</p>
                    <p><strong>优先级：</strong>{getPriorityText(record.priority)}</p>
                    <p><strong>工作量：</strong>{record.work_load}天</p>
                    <p><strong>开始日期：</strong>{record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '未设置'}</p>
                    <p><strong>结束日期：</strong>{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '未设置'}</p>
                    <p><strong>提交时间：</strong>{dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
                  </div>
                ),
                width: 600
              });
            }}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleReview(record, 'approve')}
                style={{ color: '#52c41a' }}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => handleReview(record, 'reject')}
                danger
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  const pendingCount = tasks.filter(task => task.status === 'pending').length;

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">任务审核管理</h2>
            <p className="text-gray-500 mt-1">
              审核员工提交的工作任务，通过后将进入集体评分环节
              {pendingCount > 0 && (
                <span className="text-orange-500 ml-2">
                  （待审核：{pendingCount} 个）
                </span>
              )}
            </p>
          </div>
          <Space>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待审核</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
            {pendingCount > 0 && (
              <Popconfirm
                title={`确定要批量通过 ${pendingCount} 个待审核任务吗？`}
                onConfirm={handleBatchApprove}
                okText="确定"
                cancelText="取消"
              >
                <Button type="primary">
                  批量通过 ({pendingCount})
                </Button>
              </Popconfirm>
            )}
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
        title={`${reviewingTask ? (form.getFieldValue('action') === 'approve' ? '审核通过' : '拒绝任务') : '审核任务'}`}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={500}
      >
        {reviewingTask && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <h4 className="font-medium mb-2">{reviewingTask.title}</h4>
            <p className="text-sm text-gray-600 mb-2">
              提交人：{reviewingTask.user?.name} ({reviewingTask.user?.department?.name})
            </p>
            <p className="text-sm text-gray-600">
              {reviewingTask.description}
            </p>
          </div>
        )}
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitReview}
        >
          <Form.Item name="action" style={{ display: 'none' }}>
            <Input />
          </Form.Item>

          <Form.Item
            name="review_comments"
            label="审核意见（可选）"
          >
            <TextArea
              rows={4}
              placeholder="请输入审核意见或建议..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                danger={form.getFieldValue('action') === 'reject'}
              >
                {form.getFieldValue('action') === 'approve' ? '确认通过' : '确认拒绝'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskReview;