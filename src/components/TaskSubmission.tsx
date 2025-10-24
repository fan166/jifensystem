import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Space, message, Tag, Row, Col, Spin } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

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
}

const TaskSubmission: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);
  const [form] = Form.useForm();
  const { user } = useAuthStore();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_tasks')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('加载任务失败:', error);
      message.error('加载任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({
      task_type: 'daily',
      priority: 'normal',
      work_load: 1,
      start_date: dayjs(),
      end_date: dayjs().add(1, 'week')
    });
    setIsModalVisible(true);
  };

  const handleEdit = (record: WorkTask) => {
    setEditingTask(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : null,
      end_date: record.end_date ? dayjs(record.end_date) : null
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const taskData = {
        ...values,
        user_id: user?.id,
        start_date: values.start_date?.format('YYYY-MM-DD'),
        end_date: values.end_date?.format('YYYY-MM-DD'),
        status: editingTask ? editingTask.status : 'pending'
      };

      if (editingTask) {
        const { error } = await supabase
          .from('work_tasks')
          .update(taskData)
          .eq('id', editingTask.id);
        
        if (error) throw error;
        message.success('任务更新成功');
      } else {
        const { error } = await supabase
          .from('work_tasks')
          .insert([taskData]);
        
        if (error) throw error;
        message.success('任务提交成功，等待审核');
      }

      setIsModalVisible(false);
      loadTasks();
    } catch (error) {
      console.error('提交失败:', error);
      message.error('提交失败');
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
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 100,
      render: (date: string) => date ? dayjs(date).format('MM-DD') : '-'
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 100,
      render: (date: string) => date ? dayjs(date).format('MM-DD') : '-'
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
      width: 120,
      render: (_, record: WorkTask) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'rejected') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              Modal.info({
                title: '任务详情',
                content: (
                  <div>
                    <p><strong>任务标题：</strong>{record.title}</p>
                    <p><strong>任务描述：</strong>{record.description || '无'}</p>
                    <p><strong>任务类型：</strong>{getTaskTypeText(record.task_type)}</p>
                    <p><strong>优先级：</strong>{getPriorityText(record.priority)}</p>
                    <p><strong>工作量：</strong>{record.work_load}天</p>
                    <p><strong>开始日期：</strong>{record.start_date ? dayjs(record.start_date).format('YYYY-MM-DD') : '未设置'}</p>
                    <p><strong>结束日期：</strong>{record.end_date ? dayjs(record.end_date).format('YYYY-MM-DD') : '未设置'}</p>
                  </div>
                ),
                width: 500
              });
            }}
          >
            查看
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">工作任务报备</h2>
            <p className="text-gray-500 mt-1">提交您的工作任务，等待管理员审核后参与集体评分</p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            新增任务
          </Button>
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
            scroll={{ x: 1000 }}
          />
        </Spin>
      </Card>

      <Modal
        title={editingTask ? '编辑任务' : '新增任务'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="请输入任务标题" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea
              rows={4}
              placeholder="请详细描述任务内容、目标和要求"
              maxLength={1000}
              showCount
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="task_type"
                label="任务类型"
                rules={[{ required: true, message: '请选择任务类型' }]}
              >
                <Select placeholder="请选择任务类型">
                  <Option value="daily">日常工作</Option>
                  <Option value="project">项目工作</Option>
                  <Option value="special">专项工作</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Select placeholder="请选择优先级">
                  <Option value="low">低</Option>
                  <Option value="normal">普通</Option>
                  <Option value="high">高</Option>
                  <Option value="urgent">紧急</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="work_load"
                label="预估工作量（天）"
                rules={[{ required: true, message: '请输入工作量' }]}
              >
                <Input
                  type="number"
                  placeholder="工作量"
                  min={1}
                  max={30}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker
                  placeholder="请选择开始日期"
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="end_date"
                label="结束日期"
                rules={[{ required: true, message: '请选择结束日期' }]}
              >
                <DatePicker
                  placeholder="请选择结束日期"
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingTask ? '更新任务' : '提交任务'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskSubmission;