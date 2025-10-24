import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Spin, DatePicker, Row, Col, Statistic, Tooltip, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined, BookOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { scoreAPI, scoreTypeAPI, userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Score, ScoreType, User } from '../lib/supabase';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface ScoreRecord extends Score {
  user?: { name: string; email: string; department?: { name: string } };
  recorder?: { name: string };
}

interface LearningScoreProps {
  readonly?: boolean;
}

// 学习扣分标准
const LEARNING_STANDARDS = [
  { type: '培训缺席', score: -2, description: '无故缺席培训扣2分' },
  { type: '培训迟到', score: -0.5, description: '培训迟到扣0.5分' },
  { type: '学习任务未完成', score: -1, description: '未按时完成学习任务扣1分' },
  { type: '考试不及格', score: -3, description: '培训考试不及格扣3分' },
  { type: '学习态度消极', score: -1, description: '学习态度消极扣1分' },
  { type: '不参与讨论', score: -0.5, description: '不参与学习讨论扣0.5分' }
];

// 学习加分标准
const LEARNING_BONUS = [
  { type: '主动分享', score: 1, description: '主动分享学习心得加1分' },
  { type: '考试优秀', score: 2, description: '培训考试优秀加2分' },
  { type: '学习笔记优秀', score: 1, description: '学习笔记优秀加1分' },
  { type: '帮助他人学习', score: 1, description: '帮助他人学习加1分' }
];

const LearningScore: React.FC<LearningScoreProps> = ({ readonly = false }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ScoreRecord | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [scoreTypes, setScoreTypes] = useState<ScoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [scoreType, setScoreType] = useState<'deduction' | 'bonus'>('deduction');
  const { user: currentUser } = useAuthStore();

  // 统计数据
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    totalDeduction: 0,
    totalBonus: 0,
    netScore: 0,
    affectedUsers: 0,
    avgScore: 0
  });

  useEffect(() => {
    loadData();
  }, [dateRange, selectedUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoreTypesData, usersData] = await Promise.all([
        scoreTypeAPI.getScoreTypesByCategory('basic_duty'),
        userAPI.getUsers()
      ]);
      
      // 筛选学习相关的积分类型
      const learningTypes = scoreTypesData.filter(type => 
        type.name.includes('学习') || type.name.includes('培训')
      );
      setScoreTypes(learningTypes);
      setUsers(usersData);

      // 构建查询条件
      const filters: any = { category: 'basic_duty' };
      if (selectedUser) {
        filters.userId = selectedUser;
      }
      if (dateRange) {
        filters.startDate = dateRange[0].format('YYYY-MM-DD');
        filters.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const scoresData = await scoreAPI.getScores(filters);
      // 只显示学习相关的记录
      const learningRecords = scoresData.filter(record => 
        record.score_type_id.includes('learning') || record.score_type_id.includes('training')
      );
      
      setScoreRecords(learningRecords);
      calculateStatistics(learningRecords);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (records: ScoreRecord[]) => {
    if (records.length === 0) {
      setStatistics({
        totalRecords: 0,
        totalDeduction: 0,
        totalBonus: 0,
        netScore: 0,
        affectedUsers: 0,
        avgScore: 0
      });
      return;
    }

    const deductionRecords = records.filter(r => r.score < 0);
    const bonusRecords = records.filter(r => r.score > 0);
    
    const totalDeduction = deductionRecords.reduce((sum, record) => sum + Math.abs(record.score), 0);
    const totalBonus = bonusRecords.reduce((sum, record) => sum + record.score, 0);
    const netScore = totalBonus - totalDeduction;
    const uniqueUsers = new Set(records.map(r => r.user_id)).size;
    const avgScore = records.reduce((sum, record) => sum + record.score, 0) / records.length;

    setStatistics({
      totalRecords: records.length,
      totalDeduction: Number(totalDeduction.toFixed(1)),
      totalBonus: Number(totalBonus.toFixed(1)),
      netScore: Number(netScore.toFixed(1)),
      affectedUsers: uniqueUsers,
      avgScore: Number(avgScore.toFixed(1))
    });
  };

  const columns: ColumnsType<ScoreRecord> = [
    {
      title: '姓名',
      dataIndex: ['user', 'name'],
      key: 'userName',
      width: 100,
      fixed: 'left'
    },
    {
      title: '部门',
      dataIndex: ['user', 'department', 'name'],
      key: 'department',
      width: 120
    },
    {
      title: '学习类型',
      dataIndex: 'score_type_id',
      key: 'scoreType',
      width: 120,
      render: (typeId) => <Tag color="blue">{typeId}</Tag>
    },
    {
      title: '积分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (value) => (
        <Tag color={Number(value) > 0 ? 'green' : 'red'}>
          {Number(value) > 0 ? '+' : ''}{value}分
        </Tag>
      ),
      sorter: (a, b) => a.score - b.score
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
      width: 100
    },
    {
      title: '录入时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
  ];

  if (!readonly) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    });
  }

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: ScoreRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      userId: record.user_id,
      scoreTypeId: record.score_type_id,
      score: Math.abs(record.score),
      reason: record.reason,
      learningDate: record.created_at ? dayjs(record.created_at) : dayjs(),
      scoreType: record.score > 0 ? 'bonus' : 'deduction'
    });
    setScoreType(record.score > 0 ? 'bonus' : 'deduction');
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条学习积分记录吗？',
      onOk: async () => {
        try {
          await scoreAPI.deleteScore(id);
          message.success('删除成功');
          loadData();
        } catch (error) {
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const scoreValue = values.scoreType === 'bonus' ? values.score : -Math.abs(values.score);
      const scoreData = {
        user_id: values.userId,
        score_type_id: values.scoreTypeId,
        score: scoreValue,
        reason: values.reason,
        recorder_id: currentUser?.id,
        period: values.learningDate ? values.learningDate.format('YYYY-MM') : dayjs().format('YYYY-MM')
      };

      if (editingRecord) {
        await scoreAPI.updateScore(editingRecord.id, scoreData);
        message.success('编辑成功');
      } else {
        await scoreAPI.createScore(scoreData);
        message.success('添加成功');
      }
      
      setModalVisible(false);
      loadData();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleQuickAdd = (standard: typeof LEARNING_STANDARDS[0] | typeof LEARNING_BONUS[0]) => {
    form.setFieldsValue({
      score: Math.abs(standard.score),
      reason: `${standard.type}：${standard.description}`,
      scoreType: standard.score > 0 ? 'bonus' : 'deduction'
    });
    setScoreType(standard.score > 0 ? 'bonus' : 'deduction');
  };

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} className="mb-4">
        <Col span={4}>
          <Card>
            <Statistic title="总记录数" value={statistics.totalRecords} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="总扣分" value={statistics.totalDeduction} precision={1} suffix="分" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="总加分" value={statistics.totalBonus} precision={1} suffix="分" valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="净得分" 
              value={statistics.netScore} 
              precision={1} 
              suffix="分" 
              valueStyle={{ color: statistics.netScore >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="涉及人数" value={statistics.affectedUsers} suffix="人" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="平均得分" 
              value={statistics.avgScore} 
              precision={1} 
              suffix="分"
              valueStyle={{ color: statistics.avgScore >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 学习积分标准说明 */}
      <Row gutter={16} className="mb-4">
        <Col span={12}>
          <Card size="small" title={<><InfoCircleOutlined className="mr-2 text-red-500" />学习扣分标准</>}>
            <Row gutter={[16, 8]}>
              {LEARNING_STANDARDS.map((standard, index) => (
                <Col span={12} key={index}>
                  <Tag color="red" className="mb-1">
                    {standard.type}: {Math.abs(standard.score)}分
                  </Tag>
                  <div className="text-xs text-gray-500">{standard.description}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={<><BookOutlined className="mr-2 text-green-500" />学习加分标准</>}>
            <Row gutter={[16, 8]}>
              {LEARNING_BONUS.map((standard, index) => (
                <Col span={12} key={index}>
                  <Tag color="green" className="mb-1">
                    {standard.type}: +{standard.score}分
                  </Tag>
                  <div className="text-xs text-gray-500">{standard.description}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 筛选条件 */}
      <Card className="mb-4" size="small">
        <Row gutter={16} align="middle">
          <Col span={8}>
            <div className="flex items-center">
              <span className="mr-2">人员筛选：</span>
              <Select
                placeholder="选择人员"
                allowClear
                value={selectedUser}
                onChange={setSelectedUser}
                className="flex-1"
                showSearch
                optionFilterProp="children"
              >
                {users.map(user => (
                  <Option key={user.id} value={user.id}>{user.name}</Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col span={8}>
            <div className="flex items-center">
              <span className="mr-2">时间范围：</span>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                className="flex-1"
              />
            </div>
          </Col>
          <Col span={8}>
            <div className="flex justify-end">
              {!readonly && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  添加学习积分
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={scoreRecords}
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
          scroll={{ x: 800 }}
        />
      </Spin>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑学习积分' : '添加学习积分'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ scoreType: 'deduction' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="userId"
                label="姓名"
                rules={[{ required: true, message: '请选择人员' }]}
              >
                <Select placeholder="请选择人员" showSearch optionFilterProp="children">
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>{user.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="scoreTypeId"
                label="学习类型"
                rules={[{ required: true, message: '请选择学习类型' }]}
              >
                <Select placeholder="请选择学习类型">
                  {scoreTypes.map(type => (
                    <Option key={type.id} value={type.id}>{type.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="scoreType"
                label="积分类型"
                rules={[{ required: true, message: '请选择积分类型' }]}
              >
                <Select value={scoreType} onChange={setScoreType}>
                  <Option value="deduction">扣分</Option>
                  <Option value="bonus">加分</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="score"
                label={scoreType === 'deduction' ? '扣分值' : '加分值'}
                rules={[{ required: true, message: '请输入积分值' }]}
              >
                <InputNumber
                  placeholder="请输入积分值"
                  min={0}
                  max={5}
                  step={0.1}
                  precision={1}
                  className="w-full"
                  addonAfter="分"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="learningDate"
                label="学习日期"
                rules={[{ required: true, message: '请选择学习日期' }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label="积分原因"
            rules={[{ required: true, message: '请输入积分原因' }]}
          >
            <TextArea
              placeholder="请输入积分原因"
              rows={3}
            />
          </Form.Item>

          {/* 快速选择标准 */}
          <Form.Item label="快速选择">
            <div className="mb-2">
              <span className="text-sm font-medium text-red-600">扣分标准：</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {LEARNING_STANDARDS.map((standard, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => handleQuickAdd(standard)}
                    className="text-left"
                    danger
                  >
                    {standard.type} ({Math.abs(standard.score)}分)
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-green-600">加分标准：</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {LEARNING_BONUS.map((standard, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => handleQuickAdd(standard)}
                    className="text-left"
                    type="primary"
                    ghost
                  >
                    {standard.type} (+{standard.score}分)
                  </Button>
                ))}
              </div>
            </div>
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingRecord ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LearningScore;