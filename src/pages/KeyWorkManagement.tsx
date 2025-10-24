import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Tag,
  Progress,
  Space,
  Tooltip,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Timeline,
  Rate,
  Divider
} from 'antd';
import KeyWorkTracking from '../components/KeyWorkTracking';
import TaskCompletionConfirmation from '../components/TaskCompletionConfirmation';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface KeyWork {
  id: string;
  work_title: string;
  work_description: string;
  work_type: string;
  priority: string;
  total_score: number;
  status: string;
  start_date: string;
  end_date: string;
  actual_completion_date?: string;
  created_by: string;
  department_id?: string;
  completion_rate: number;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  department_name?: string;
  participants?: KeyWorkParticipant[];
}

interface KeyWorkParticipant {
  id: string;
  key_work_id: string;
  user_id: string;
  role: string;
  contribution_description?: string;
  individual_score: number;
  performance_rating?: string;
  assigned_date: string;
  completion_date?: string;
  is_active: boolean;
  user_name?: string;
}

interface KeyWorkEvaluation {
  id: string;
  key_work_id: string;
  participant_id: string;
  evaluator_id: string;
  innovation_score: number;
  execution_score: number;
  collaboration_score: number;
  result_score: number;
  total_score: number;
  evaluation_comments?: string;
  evaluation_date: string;
}

const KeyWorkManagement: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('my_works');
  const [keyWorks, setKeyWorks] = useState<KeyWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [evaluationModalVisible, setEvaluationModalVisible] = useState(false);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  const [editingWork, setEditingWork] = useState<KeyWork | null>(null);
  const [selectedWork, setSelectedWork] = useState<KeyWork | null>(null);
  const [form] = Form.useForm();
  const [evaluationForm] = Form.useForm();
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [statistics, setStatistics] = useState({
    total: 0,
    in_progress: 0,
    completed: 0,
    avg_score: 0
  });

  // 工作类型映射
  const workTypeMap = {
    major_project: '重大项目',
    special_activity: '专项活动',
    difficult_task: '难点工作',
    innovation_project: '创新项目',
    emergency_response: '应急响应'
  };

  // 优先级映射
  const priorityMap = {
    medium: '中等',
    high: '高',
    urgent: '紧急'
  };

  // 状态映射
  const statusMap = {
    planning: '规划中',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    on_hold: '暂停'
  };

  // 角色映射
  const roleMap = {
    leader: '负责人',
    main_participant: '主要参与者',
    participant: '参与者',
    supporter: '支持者',
    coordinator: '协调者'
  };

  useEffect(() => {
    fetchKeyWorks();
    fetchUsers();
    fetchDepartments();
    fetchStatistics();
  }, [activeTab]);

  // 获取重点工作列表
  const fetchKeyWorks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('key_works')
        .select(`
          *,
          creator:users!created_by(name),
          department:departments(name),
          participants:key_work_participants(
            *,
            user:users(name)
          )
        `);

      // 根据标签页过滤数据
      if (activeTab === 'my_works') {
        // 我参与的工作 - 简化查询逻辑
        query = query.eq('created_by', user?.id);
      } else if (activeTab === 'all_works' && !hasPermission('write')) {
        // 普通用户只能看到自己创建的工作
        query = query.eq('created_by', user?.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(work => ({
        ...work,
        creator_name: work.creator?.name,
        department_name: work.department?.name,
        participants: work.participants?.map((p: any) => ({
          ...p,
          user_name: p.user?.name
        }))
      })) || [];

      setKeyWorks(formattedData);
    } catch (error) {
      console.error('获取重点工作失败:', error);
      message.error('获取重点工作失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, department_id');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true);

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const { data, error } = await supabase
        .from('key_works')
        .select('status, total_score');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        in_progress: data?.filter(w => w.status === 'in_progress').length || 0,
        completed: data?.filter(w => w.status === 'completed').length || 0,
        avg_score: data?.length ? 
          data.reduce((sum, w) => sum + (w.total_score || 0), 0) / data.length : 0
      };

      setStatistics(stats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // UUID格式验证函数
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // 生成UUID函数
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // 创建或更新重点工作
  const handleSubmit = async (values: any) => {
    try {
      console.log('提交的表单数据:', values);
      console.log('当前用户:', user);

      // 验证必填字段
      if (!values.work_title?.trim()) {
        message.error('请输入工作标题');
        return;
      }
      if (!values.work_description?.trim()) {
        message.error('请输入工作描述');
        return;
      }
      if (!values.work_type) {
        message.error('请选择工作类型');
        return;
      }
      if (!values.date_range || values.date_range.length !== 2) {
        message.error('请选择工作周期');
        return;
      }
      if (!user?.id) {
        message.error('用户信息异常，请重新登录');
        return;
      }

      // 验证用户ID格式并处理临时用户ID
      let validUserId = user.id;
      if (!isValidUUID(user.id)) {
        console.warn('用户ID不是有效的UUID格式:', user.id);
        
        // 如果是临时用户ID，生成一个新的UUID
        if (user.id === 'temp-user-id' || user.id.startsWith('temp-')) {
          validUserId = generateUUID();
          console.log('为临时用户生成新的UUID:', validUserId);
          
          // 更新用户存储中的ID
          const updatedUser = { ...user, id: validUserId };
          useAuthStore.getState().setUser(updatedUser);
          
          message.info('已为您分配新的用户标识');
        } else {
          message.error('用户标识格式无效，请重新登录');
          return;
        }
      }

      // 验证用户ID是否在数据库中存在
      console.log('验证用户ID是否存在:', validUserId);
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', validUserId)
        .single();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        console.error('检查用户存在性时出错:', userCheckError);
        message.error('验证用户信息时出错，请重试');
        return;
      }

      if (!userExists) {
        console.error('用户ID在数据库中不存在:', validUserId);
        message.error('用户信息不存在，请重新登录');
        return;
      }

      // 验证部门ID是否有效（如果提供了部门ID）
      if (values.department_id) {
        console.log('验证部门ID是否存在且有效:', values.department_id);
        const { data: departmentExists, error: deptCheckError } = await supabase
          .from('departments')
          .select('id, name, is_active')
          .eq('id', values.department_id)
          .eq('is_active', true)
          .single();

        if (deptCheckError && deptCheckError.code !== 'PGRST116') {
          console.error('检查部门存在性时出错:', deptCheckError);
          message.error('验证部门信息时出错，请重试');
          return;
        }

        if (!departmentExists) {
          console.error('部门ID不存在或已停用:', values.department_id);
          message.error('所选部门不存在或已停用，请重新选择');
          return;
        }

        console.log('部门验证通过:', departmentExists);
      }

      // 构建工作数据，确保字段名与数据库表一致
      const workData = {
        work_title: values.work_title.trim(),
        work_description: values.work_description.trim(),
        work_type: values.work_type,
        priority: values.priority || 'high', // 设置默认值
        total_score: Number(values.total_score) || 0, // 确保是数字类型
        status: 'planning', // 新建时默认为planning状态
        start_date: values.date_range[0].format('YYYY-MM-DD'),
        end_date: values.date_range[1].format('YYYY-MM-DD'),
        department_id: values.department_id || null, // 允许为空
        created_by: validUserId, // 使用验证过的UUID
        completion_rate: 0 // 新建时默认完成率为0
      };

      console.log('准备提交的工作数据:', workData);

      let result;
      if (editingWork) {
        // 更新时移除不需要的字段
        const updateData = { ...workData };
        delete updateData.created_by; // 更新时不修改创建者
        delete updateData.status; // 更新时不重置状态
        
        result = await supabase
          .from('key_works')
          .update(updateData)
          .eq('id', editingWork.id)
          .select();
      } else {
        // 创建
        result = await supabase
          .from('key_works')
          .insert([workData])
          .select();
      }

      console.log('数据库操作结果:', result);

      if (result.error) {
        console.error('数据库错误详情:', result.error);
        throw result.error;
      }

      if (!result.data || result.data.length === 0) {
        throw new Error('创建失败：未返回数据');
      }

      // 处理参与人员
      if (values.participants && values.participants.length > 0) {
        const workId = editingWork?.id || result.data[0].id;
        
        if (editingWork) {
          // 删除原有参与人员
          const { error: deleteError } = await supabase
            .from('key_work_participants')
            .delete()
            .eq('key_work_id', workId);
          
          if (deleteError) {
            console.error('删除原有参与人员失败:', deleteError);
          }
        }

        // 验证参与人员的用户ID是否存在
        for (const participant of values.participants) {
          if (participant.user_id) {
            console.log('验证参与人员用户ID:', participant.user_id);
            const { data: participantUserExists, error: participantUserCheckError } = await supabase
              .from('users')
              .select('id, name')
              .eq('id', participant.user_id)
              .single();

            if (participantUserCheckError && participantUserCheckError.code !== 'PGRST116') {
              console.error('检查参与人员用户存在性时出错:', participantUserCheckError);
              message.error(`验证参与人员信息时出错，请重试`);
              return;
            }

            if (!participantUserExists) {
              console.error('参与人员用户ID不存在:', participant.user_id);
              message.error(`参与人员用户不存在，请重新选择`);
              return;
            }
          }
        }

        // 添加新的参与人员
        const participantData = values.participants.map((p: any) => ({
          key_work_id: workId,
          user_id: p.user_id,
          role: p.role || 'participant', // 设置默认角色
          contribution_description: p.contribution_description || null,
          individual_score: 0,
          assigned_date: dayjs().format('YYYY-MM-DD'),
          is_active: true
        }));

        console.log('准备添加的参与人员数据:', participantData);

        const { error: participantError } = await supabase
          .from('key_work_participants')
          .insert(participantData);

        if (participantError) {
          console.error('添加参与人员失败:', participantError);
          // 参与人员添加失败不影响主要工作的创建
          message.warning('重点工作创建成功，但添加参与人员时出现问题');
        }
      }

      message.success(editingWork ? '更新成功' : '创建成功');
      setModalVisible(false);
      setEditingWork(null);
      form.resetFields();
      fetchKeyWorks();
    } catch (error: any) {
      console.error('操作失败详情:', error);
      
      // 提供更详细的错误信息
      let errorMessage = '操作失败';
      if (error?.message) {
        if (error.message.includes('duplicate key')) {
          errorMessage = '数据重复，请检查是否已存在相同的工作';
        } else if (error.message.includes('foreign key')) {
          if (error.message.includes('department')) {
            errorMessage = '部门信息错误，请检查所选部门是否有效';
          } else if (error.message.includes('user')) {
            errorMessage = '用户信息错误，请检查用户是否存在';
          } else {
            errorMessage = '关联数据错误，请检查部门或用户信息';
          }
        } else if (error.message.includes('not null')) {
          if (error.message.includes('work_title')) {
            errorMessage = '工作标题不能为空';
          } else if (error.message.includes('work_type')) {
            errorMessage = '工作类型不能为空';
          } else if (error.message.includes('created_by')) {
            errorMessage = '创建者信息不能为空';
          } else {
            errorMessage = '必填字段不能为空';
          }
        } else if (error.message.includes('check constraint')) {
          if (error.message.includes('work_type')) {
            errorMessage = '工作类型格式不正确，请选择有效的工作类型';
          } else if (error.message.includes('priority')) {
            errorMessage = '优先级格式不正确，请选择有效的优先级';
          } else if (error.message.includes('status')) {
            errorMessage = '状态格式不正确';
          } else {
            errorMessage = '数据格式不符合要求';
          }
        } else if (error.message.includes('invalid input syntax for type uuid')) {
          errorMessage = '用户或部门标识格式无效，请重新登录或选择';
        } else {
          errorMessage = `操作失败: ${error.message}`;
        }
      }
      
      console.error('最终错误信息:', errorMessage);
      message.error(errorMessage);
    }
  };

  // 删除重点工作
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('key_works')
        .delete()
        .eq('id', id);

      if (error) throw error;

      message.success('删除成功');
      fetchKeyWorks();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 更新工作状态
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const updateData: any = { status };
      if (status === 'completed') {
        updateData.actual_completion_date = dayjs().format('YYYY-MM-DD');
        updateData.completion_rate = 100;
      }

      const { error } = await supabase
        .from('key_works')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      message.success('状态更新成功');
      fetchKeyWorks();
    } catch (error) {
      console.error('状态更新失败:', error);
      message.error('状态更新失败');
    }
  };

  // 提交评价
  const handleEvaluationSubmit = async (values: any) => {
    try {
      const evaluationData = {
        key_work_id: selectedWork?.id,
        participant_id: values.participant_id,
        evaluator_id: user?.id,
        innovation_score: values.innovation_score,
        execution_score: values.execution_score,
        collaboration_score: values.collaboration_score,
        result_score: values.result_score,
        total_score: values.innovation_score + values.execution_score + 
                    values.collaboration_score + values.result_score,
        evaluation_comments: values.evaluation_comments
      };

      const { error } = await supabase
        .from('key_work_evaluations')
        .insert([evaluationData]);

      if (error) throw error;

      // 更新参与者个人得分
      const { error: updateError } = await supabase
        .from('key_work_participants')
        .update({ individual_score: evaluationData.total_score })
        .eq('id', values.participant_id);

      if (updateError) throw updateError;

      message.success('评价提交成功');
      setEvaluationModalVisible(false);
      evaluationForm.resetFields();
      fetchKeyWorks();
    } catch (error) {
      console.error('评价提交失败:', error);
      message.error('评价提交失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<KeyWork> = [
    {
      title: '工作标题',
      dataIndex: 'work_title',
      key: 'work_title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '工作类型',
      dataIndex: 'work_type',
      key: 'work_type',
      width: 100,
      render: (type: string) => (
        <Tag color="blue">{workTypeMap[type as keyof typeof workTypeMap]}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: string) => {
        const colors = { medium: 'default', high: 'orange', urgent: 'red' };
        return (
          <Tag color={colors[priority as keyof typeof colors]}>
            {priorityMap[priority as keyof typeof priorityMap]}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors = {
          planning: 'default',
          in_progress: 'processing',
          completed: 'success',
          cancelled: 'error',
          on_hold: 'warning'
        };
        return (
          <Tag color={colors[status as keyof typeof colors]}>
            {statusMap[status as keyof typeof statusMap]}
          </Tag>
        );
      },
    },
    {
      title: '完成进度',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      width: 120,
      render: (rate: number) => (
        <Progress percent={rate} size="small" />
      ),
    },
    {
      title: '拟奖励重点分',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 120,
      render: (score: number) => (
        <span className="font-medium text-blue-600">{score}</span>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      key: 'creator_name',
      width: 100,
    },
    {
      title: '开始日期',
      dataIndex: 'start_date',
      key: 'start_date',
      width: 100,
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: '结束日期',
      dataIndex: 'end_date',
      key: 'end_date',
      width: 100,
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedWork(record);
                setDetailModalVisible(true);
              }}
            />
          </Tooltip>
          
          <Tooltip title="进度跟踪">
            <Button
              type="text"
              icon={<ClockCircleOutlined />}
              className="text-blue-600"
              onClick={() => {
                setSelectedWork(record);
                setActiveTab('tracking');
              }}
            />
          </Tooltip>
          
          {(hasPermission('write') || record.created_by === user?.id) && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingWork(record);
                    form.setFieldsValue({
                      ...record,
                      date_range: [dayjs(record.start_date), dayjs(record.end_date)],
                      participants: record.participants?.map(p => ({
                        user_id: p.user_id,
                        role: p.role,
                        contribution_description: p.contribution_description
                      }))
                    });
                    setModalVisible(true);
                  }}
                />
              </Tooltip>
              
              {record.status !== 'completed' && (
                <Tooltip title="完成确认">
                  <Button
                    type="text"
                    icon={<CheckCircleOutlined />}
                    className="text-green-600"
                    onClick={() => {
                      setSelectedWork(record);
                      setCompletionModalVisible(true);
                    }}
                  />
                </Tooltip>
              )}
              
              <Tooltip title="删除">
                <Popconfirm
                  title="确认删除？"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    danger
                  />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          
          {hasPermission('write') && record.status === 'completed' && (
            <Tooltip title="评价">
              <Button
                type="text"
                icon={<TrophyOutlined />}
                className="text-orange-600"
                onClick={() => {
                  setSelectedWork(record);
                  setEvaluationModalVisible(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="总工作数"
              value={statistics.total}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={statistics.in_progress}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均得分"
              value={statistics.avg_score}
              precision={1}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">重点工作管理</h2>
          {hasPermission('write') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingWork(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              新建重点工作
            </Button>
          )}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'my_works',
              label: '我的工作',
              children: (
                <Table
                  columns={columns}
                  dataSource={keyWorks}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                  }}
                />
              ),
            },
            ...(hasPermission('write') ? [{
              key: 'all_works',
              label: '全部工作',
              children: (
                <Table
                  columns={columns}
                  dataSource={keyWorks}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                  }}
                />
              ),
            }] : []),
            {
              key: 'tracking',
              label: '进度跟踪',
              children: selectedWork ? (
                <KeyWorkTracking 
                  keyWorkId={selectedWork?.id || ''}
                  keyWorkTitle={selectedWork?.work_title || ''}
                  canEdit={hasPermission('write')}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  请先选择一个重点工作进行跟踪
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* 新建/编辑模态框 */}
      <Modal
        title={editingWork ? '编辑重点工作' : '新建重点工作'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingWork(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="work_title"
                label="工作标题"
                rules={[{ required: true, message: '请输入工作标题' }]}
              >
                <Input placeholder="请输入工作标题" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="work_type"
                label="工作类型"
                rules={[{ required: true, message: '请选择工作类型' }]}
              >
                <Select placeholder="请选择工作类型">
                  {Object.entries(workTypeMap).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
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
                  {Object.entries(priorityMap).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="total_score"
                label="拟奖励重点分"
                rules={[{ required: true, message: '请输入拟奖励重点分' }]}
              >
                <InputNumber
                  min={0}
                  max={20}
                  step={0.5}
                  placeholder="拟奖励重点分"
                  className="w-full"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date_range"
                label="工作周期"
                rules={[{ required: true, message: '请选择工作周期' }]}
              >
                <RangePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department_id"
                label="负责部门"
              >
                <Select placeholder="请选择负责部门" allowClear>
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="work_description"
            label="工作描述"
            rules={[{ required: true, message: '请输入工作描述' }]}
          >
            <TextArea rows={4} placeholder="请输入工作描述" />
          </Form.Item>

          <Form.List name="participants">
            {(fields, { add, remove }) => (
              <>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-medium">参与人员</label>
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>
                    添加参与人员
                  </Button>
                </div>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={16} className="mb-2">
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'user_id']}
                        rules={[{ required: true, message: '请选择用户' }]}
                      >
                        <Select placeholder="选择用户">
                          {users.map(user => (
                            <Option key={user.id} value={user.id}>{user.name}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'role']}
                        rules={[{ required: true, message: '请选择角色' }]}
                      >
                        <Select placeholder="选择角色">
                          {Object.entries(roleMap).map(([key, value]) => (
                            <Option key={key} value={key}>{value}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'contribution_description']}
                      >
                        <Input placeholder="贡献描述" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Col>
                  </Row>
                ))}
              </>
            )}
          </Form.List>

          <div className="flex justify-end space-x-2 mt-6">
            <Button onClick={() => {
              setModalVisible(false);
              setEditingWork(null);
              form.resetFields();
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              {editingWork ? '更新' : '创建'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="重点工作详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedWork && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">工作标题：</label>
                  <div className="mt-1">{selectedWork.work_title}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">工作类型：</label>
                  <div className="mt-1">
                    <Tag color="blue">
                      {workTypeMap[selectedWork.work_type as keyof typeof workTypeMap]}
                    </Tag>
                  </div>
                </div>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">优先级：</label>
                  <div className="mt-1">
                    <Tag color={selectedWork.priority === 'urgent' ? 'red' : 
                              selectedWork.priority === 'high' ? 'orange' : 'default'}>
                      {priorityMap[selectedWork.priority as keyof typeof priorityMap]}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">状态：</label>
                  <div className="mt-1">
                    <Tag color={selectedWork.status === 'completed' ? 'success' : 
                              selectedWork.status === 'in_progress' ? 'processing' : 'default'}>
                      {statusMap[selectedWork.status as keyof typeof statusMap]}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={8}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">拟奖励重点分：</label>
                  <div className="mt-1 text-blue-600 font-medium">{selectedWork.total_score}</div>
                </div>
              </Col>
            </Row>

            <div className="mb-4">
              <label className="font-medium text-gray-600">工作描述：</label>
              <div className="mt-1 p-3 bg-gray-50 rounded">{selectedWork.work_description}</div>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">开始日期：</label>
                  <div className="mt-1">{dayjs(selectedWork.start_date).format('YYYY-MM-DD')}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="mb-4">
                  <label className="font-medium text-gray-600">结束日期：</label>
                  <div className="mt-1">{dayjs(selectedWork.end_date).format('YYYY-MM-DD')}</div>
                </div>
              </Col>
            </Row>

            <div className="mb-4">
              <label className="font-medium text-gray-600">完成进度：</label>
              <div className="mt-2">
                <Progress percent={selectedWork.completion_rate} />
              </div>
            </div>

            {selectedWork.participants && selectedWork.participants.length > 0 && (
              <div>
                <Divider>参与人员</Divider>
                <div className="space-y-2">
                  {selectedWork.participants.map(participant => (
                    <div key={participant.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{participant.user_name}</span>
                        <Tag className="ml-2" color="blue">
                          {roleMap[participant.role as keyof typeof roleMap]}
                        </Tag>
                        {participant.contribution_description && (
                          <div className="text-sm text-gray-600 mt-1">
                            {participant.contribution_description}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-medium text-blue-600">
                          {participant.individual_score}
                        </div>
                        <div className="text-xs text-gray-500">个人得分</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 评价模态框 */}
      <Modal
        title="工作评价"
        open={evaluationModalVisible}
        onCancel={() => {
          setEvaluationModalVisible(false);
          evaluationForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={evaluationForm}
          layout="vertical"
          onFinish={handleEvaluationSubmit}
        >
          <Form.Item
            name="participant_id"
            label="评价对象"
            rules={[{ required: true, message: '请选择评价对象' }]}
          >
            <Select placeholder="请选择评价对象">
              {selectedWork?.participants?.map(participant => (
                <Option key={participant.id} value={participant.id}>
                  {participant.user_name} - {roleMap[participant.role as keyof typeof roleMap]}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="innovation_score"
                label="创新能力 (0-5分)"
                rules={[{ required: true, message: '请评分' }]}
              >
                <Rate count={5} allowHalf />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="execution_score"
                label="执行能力 (0-5分)"
                rules={[{ required: true, message: '请评分' }]}
              >
                <Rate count={5} allowHalf />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="collaboration_score"
                label="协作能力 (0-5分)"
                rules={[{ required: true, message: '请评分' }]}
              >
                <Rate count={5} allowHalf />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="result_score"
                label="结果质量 (0-5分)"
                rules={[{ required: true, message: '请评分' }]}
              >
                <Rate count={5} allowHalf />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="evaluation_comments"
            label="评价意见"
          >
            <TextArea rows={4} placeholder="请输入评价意见" />
          </Form.Item>

          <div className="flex justify-end space-x-2">
            <Button onClick={() => {
              setEvaluationModalVisible(false);
              evaluationForm.resetFields();
            }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              提交评价
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 任务完成确认模态框 */}
      <TaskCompletionConfirmation
        visible={completionModalVisible}
        onCancel={() => {
          setCompletionModalVisible(false);
          setSelectedWork(null);
        }}
        keyWork={selectedWork}
        onSuccess={() => {
          fetchKeyWorks();
          fetchStatistics();
          message.success('任务闭环完成！');
        }}
      />
    </div>
  );
};

export default KeyWorkManagement;