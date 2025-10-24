import React, { useState, useEffect } from 'react';
import {
  Card,
  Timeline,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Progress,
  Tag,
  Space,
  message,
  Upload,
  List,
  Avatar,
  Tooltip,
  Row,
  Col,
  Statistic,
  DatePicker
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface KeyWorkMilestone {
  id: string;
  key_work_id: string;
  milestone_title: string;
  milestone_description?: string;
  target_date: string;
  actual_date?: string;
  status: string;
  completion_rate: number;
  created_by: string;
  created_at: string;
  creator_name?: string;
}

interface KeyWorkProgress {
  id: string;
  key_work_id: string;
  progress_description: string;
  completion_percentage: number;
  attachments?: string[];
  reported_by: string;
  reported_at: string;
  reporter_name?: string;
}

interface KeyWorkTrackingProps {
  keyWorkId: string;
  keyWorkTitle: string;
  canEdit: boolean;
}

const KeyWorkTracking: React.FC<KeyWorkTrackingProps> = ({
  keyWorkId,
  keyWorkTitle,
  canEdit
}) => {
  const { user } = useAuthStore();
  const [milestones, setMilestones] = useState<KeyWorkMilestone[]>([]);
  const [progressReports, setProgressReports] = useState<KeyWorkProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [milestoneModalVisible, setMilestoneModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [milestoneForm] = Form.useForm();
  const [progressForm] = Form.useForm();
  const [editingMilestone, setEditingMilestone] = useState<KeyWorkMilestone | null>(null);

  useEffect(() => {
    fetchMilestones();
    fetchProgressReports();
  }, [keyWorkId]);

  // 获取里程碑列表
  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('key_work_milestones')
        .select(`
          *,
          creator:users!created_by(name)
        `)
        .eq('key_work_id', keyWorkId)
        .order('target_date', { ascending: true });

      if (error) throw error;

      const formattedData = data?.map(milestone => ({
        ...milestone,
        creator_name: milestone.creator?.name
      })) || [];

      setMilestones(formattedData);
    } catch (error) {
      console.error('获取里程碑失败:', error);
      message.error('获取里程碑失败');
    }
  };

  // 获取进度报告列表
  const fetchProgressReports = async () => {
    try {
      const { data, error } = await supabase
        .from('key_work_progress')
        .select(`
          *,
          reporter:users!reported_by(name)
        `)
        .eq('key_work_id', keyWorkId)
        .order('reported_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(progress => ({
        ...progress,
        reporter_name: progress.reporter?.name
      })) || [];

      setProgressReports(formattedData);
    } catch (error) {
      console.error('获取进度报告失败:', error);
      message.error('获取进度报告失败');
    }
  };

  // 创建或更新里程碑
  const handleMilestoneSubmit = async (values: any) => {
    try {
      const milestoneData = {
        key_work_id: keyWorkId,
        milestone_title: values.milestone_title,
        milestone_description: values.milestone_description,
        target_date: values.target_date.format('YYYY-MM-DD'),
        created_by: user?.id
      };

      let result;
      if (editingMilestone) {
        result = await supabase
          .from('key_work_milestones')
          .update(milestoneData)
          .eq('id', editingMilestone.id);
      } else {
        result = await supabase
          .from('key_work_milestones')
          .insert([milestoneData]);
      }

      if (result.error) throw result.error;

      message.success(editingMilestone ? '里程碑更新成功' : '里程碑创建成功');
      setMilestoneModalVisible(false);
      setEditingMilestone(null);
      milestoneForm.resetFields();
      fetchMilestones();
    } catch (error) {
      console.error('里程碑操作失败:', error);
      message.error('里程碑操作失败');
    }
  };

  // 更新里程碑状态
  const handleMilestoneStatusUpdate = async (milestoneId: string, status: string, completionRate: number) => {
    try {
      const updateData: any = { status, completion_rate: completionRate };
      if (status === 'completed') {
        updateData.actual_date = dayjs().format('YYYY-MM-DD');
      }

      const { error } = await supabase
        .from('key_work_milestones')
        .update(updateData)
        .eq('id', milestoneId);

      if (error) throw error;

      message.success('里程碑状态更新成功');
      fetchMilestones();
    } catch (error) {
      console.error('里程碑状态更新失败:', error);
      message.error('里程碑状态更新失败');
    }
  };

  // 提交进度报告
  const handleProgressSubmit = async (values: any) => {
    try {
      const progressData = {
        key_work_id: keyWorkId,
        progress_description: values.progress_description,
        completion_percentage: values.completion_percentage,
        reported_by: user?.id
      };

      const { error } = await supabase
        .from('key_work_progress')
        .insert([progressData]);

      if (error) throw error;

      message.success('进度报告提交成功');
      setProgressModalVisible(false);
      progressForm.resetFields();
      fetchProgressReports();
    } catch (error) {
      console.error('进度报告提交失败:', error);
      message.error('进度报告提交失败');
    }
  };

  // 状态映射
  const statusMap = {
    pending: { text: '待开始', color: 'default' },
    in_progress: { text: '进行中', color: 'processing' },
    completed: { text: '已完成', color: 'success' },
    delayed: { text: '延期', color: 'error' }
  };

  // 计算总体进度
  const calculateOverallProgress = () => {
    if (milestones.length === 0) return 0;
    const totalProgress = milestones.reduce((sum, milestone) => sum + milestone.completion_rate, 0);
    return Math.round(totalProgress / milestones.length);
  };

  return (
    <div className="space-y-6">
      {/* 总体进度统计 */}
      <Card title="总体进度">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="总体完成率"
              value={calculateOverallProgress()}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="里程碑总数"
              value={milestones.length}
              prefix={<CalendarOutlined />}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="已完成里程碑"
              value={milestones.filter(m => m.status === 'completed').length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
        </Row>
        <div className="mt-4">
          <Progress percent={calculateOverallProgress()} strokeColor="#1890ff" />
        </div>
      </Card>

      {/* 里程碑管理 */}
      <Card
        title="里程碑管理"
        extra={
          canEdit && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingMilestone(null);
                milestoneForm.resetFields();
                setMilestoneModalVisible(true);
              }}
            >
              添加里程碑
            </Button>
          )
        }
      >
        {milestones.length > 0 ? (
          <Timeline>
            {milestones.map(milestone => {
              const status = statusMap[milestone.status as keyof typeof statusMap];
              const isOverdue = milestone.status !== 'completed' && 
                dayjs().isAfter(dayjs(milestone.target_date));
              
              return (
                <Timeline.Item
                  key={milestone.id}
                  dot={
                    milestone.status === 'completed' ? (
                      <CheckCircleOutlined className="text-green-500" />
                    ) : isOverdue ? (
                      <ExclamationCircleOutlined className="text-red-500" />
                    ) : (
                      <ClockCircleOutlined className="text-blue-500" />
                    )
                  }
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-lg">{milestone.milestone_title}</h4>
                      {milestone.milestone_description && (
                        <p className="text-gray-600 mt-1">{milestone.milestone_description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2">
                        <Tag color={status.color}>{status.text}</Tag>
                        <span className="text-sm text-gray-500">
                          目标日期: {dayjs(milestone.target_date).format('YYYY-MM-DD')}
                        </span>
                        {milestone.actual_date && (
                          <span className="text-sm text-gray-500">
                            完成日期: {dayjs(milestone.actual_date).format('YYYY-MM-DD')}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          创建人: {milestone.creator_name}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Progress 
                          percent={milestone.completion_rate} 
                          size="small"
                          status={milestone.status === 'completed' ? 'success' : 'active'}
                        />
                      </div>
                    </div>
                    {canEdit && milestone.status !== 'completed' && (
                      <Space>
                        <Button
                          size="small"
                          onClick={() => handleMilestoneStatusUpdate(milestone.id, 'completed', 100)}
                        >
                          标记完成
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingMilestone(milestone);
                            milestoneForm.setFieldsValue({
                              ...milestone,
                              target_date: dayjs(milestone.target_date)
                            });
                            setMilestoneModalVisible(true);
                          }}
                        >
                          编辑
                        </Button>
                      </Space>
                    )}
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        ) : (
          <div className="text-center text-gray-500 py-8">
            暂无里程碑，请添加里程碑来跟踪工作进度
          </div>
        )}
      </Card>

      {/* 进度报告 */}
      <Card
        title="进度报告"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              progressForm.resetFields();
              setProgressModalVisible(true);
            }}
          >
            提交进度
          </Button>
        }
      >
        {progressReports.length > 0 ? (
          <List
            itemLayout="vertical"
            dataSource={progressReports}
            renderItem={report => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <div className="flex justify-between items-center">
                      <span>{report.reporter_name}</span>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          type="circle" 
                          size={40} 
                          percent={report.completion_percentage}
                        />
                        <span className="text-sm text-gray-500">
                          {dayjs(report.reported_at).format('YYYY-MM-DD HH:mm')}
                        </span>
                      </div>
                    </div>
                  }
                  description={report.progress_description}
                />
              </List.Item>
            )}
          />
        ) : (
          <div className="text-center text-gray-500 py-8">
            暂无进度报告
          </div>
        )}
      </Card>

      {/* 里程碑模态框 */}
      <Modal
        title={editingMilestone ? '编辑里程碑' : '添加里程碑'}
        open={milestoneModalVisible}
        onCancel={() => {
          setMilestoneModalVisible(false);
          setEditingMilestone(null);
          milestoneForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={milestoneForm}
          layout="vertical"
          onFinish={handleMilestoneSubmit}
        >
          <Form.Item
            name="milestone_title"
            label="里程碑标题"
            rules={[{ required: true, message: '请输入里程碑标题' }]}
          >
            <Input placeholder="请输入里程碑标题" />
          </Form.Item>

          <Form.Item
            name="milestone_description"
            label="里程碑描述"
          >
            <TextArea rows={3} placeholder="请输入里程碑描述" />
          </Form.Item>

          <Form.Item
            name="target_date"
            label="目标完成日期"
            rules={[{ required: true, message: '请选择目标完成日期' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={() => {
              setMilestoneModalVisible(false);
              setEditingMilestone(null);
              milestoneForm.resetFields();
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              {editingMilestone ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 进度报告模态框 */}
      <Modal
        title="提交进度报告"
        open={progressModalVisible}
        onCancel={() => {
          setProgressModalVisible(false);
          progressForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={progressForm}
          layout="vertical"
          onFinish={handleProgressSubmit}
        >
          <Form.Item
            name="completion_percentage"
            label="完成百分比"
            rules={[{ required: true, message: '请输入完成百分比' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={5}
              formatter={value => `${value}%`}
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            name="progress_description"
            label="进度描述"
            rules={[{ required: true, message: '请输入进度描述' }]}
          >
            <TextArea rows={4} placeholder="请详细描述当前工作进度、已完成的任务和遇到的问题" />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={() => {
              setProgressModalVisible(false);
              progressForm.resetFields();
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              提交报告
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default KeyWorkTracking;