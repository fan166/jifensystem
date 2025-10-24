import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Spin, DatePicker, Row, Col, Statistic, Tooltip, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined, BookOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { scoreAPI, scoreTypeAPI, userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Score, ScoreType, User } from '../lib/supabase';
import dayjs from 'dayjs';
import './LearningScore.css'; // 引入样式文件

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface ScoreRecord extends Score {
  user?: { name: string; email: string; department?: { name: string } };
  recorder?: { name: string };
}

interface LearningScoreProps {
  readonly?: boolean;
  currentUserId?: string; // 当前用户ID，用于权限控制
}

// 学习扣分标准
const LEARNING_STANDARDS = [
  { type: '缺席会议', score: -0.5, description: '无故未参加上级或本级召开的各类会议，包括政治学习教育、业务培训、政策法规和党风廉政建设学习，以及支部"三会一课"活动、青年理论小组学习等，每例扣0.5分' },
  { type: '未完成学习任务', score: -0.5, description: '未按要求完成学习任务、做好学习笔记、上交心得体会文章的，每例扣0.5分' },
  { type: '学习活动参与率不足', score: -2, description: '年度累计参加学习活动不足总次数的60%的，扣2分' }
];



const LearningScore: React.FC<LearningScoreProps> = ({ readonly = false, currentUserId }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ScoreRecord | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [scoreTypes, setScoreTypes] = useState<ScoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [selectedDeductionType, setSelectedDeductionType] = useState<string>(''); // 扣分类型筛选
  const [scoreType, setScoreType] = useState<'deduction' | 'bonus'>('deduction');
  const { user: currentUser } = useAuthStore();

  // 统计数据
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    totalDeduction: 0,
    netScore: 0,
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

      // 构建查询条件 - 专门获取当前用户的基础学习扣分记录
      const filters: any = { 
        category: 'basic_duty',
        userId: currentUserId || currentUser?.id // 确保只查询当前用户的记录
      };
      
      if (dateRange) {
        filters.startDate = dateRange[0].format('YYYY-MM-DD');
        filters.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const scoresData = await scoreAPI.getScores(filters);
      
      // 只显示学习相关的扣分记录（负分）
      let learningDeductionRecords = scoresData.filter(record => {
        const isLearningRelated = record.score_type_id.includes('learning') || 
                                 record.score_type_id.includes('training') ||
                                 (record.reason && (
                                   record.reason.includes('学习') ||
                                   record.reason.includes('培训') ||
                                   record.reason.includes('会议') ||
                                   record.reason.includes('缺席') ||
                                   record.reason.includes('未完成') ||
                                   record.reason.includes('参与率')
                                 ));
        const isDeduction = record.score < 0; // 只显示扣分记录
        return isLearningRelated && isDeduction;
      });

      // 根据选择的扣分类型进行筛选
      if (selectedDeductionType) {
        learningDeductionRecords = learningDeductionRecords.filter(record => {
          if (!record.reason) return false;
          
          switch (selectedDeductionType) {
            case '缺席会议':
              return record.reason.includes('缺席') && record.reason.includes('会议');
            case '未完成学习任务':
              return record.reason.includes('未完成') && (record.reason.includes('学习任务') || record.reason.includes('笔记') || record.reason.includes('心得'));
            case '学习活动参与率不足':
              return record.reason.includes('参与率') && (record.reason.includes('不足') || record.reason.includes('60%'));
            default:
              return true;
          }
        });
      }
      
      setScoreRecords(learningDeductionRecords);
      calculateStatistics(learningDeductionRecords);
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
        netScore: 0,
        avgScore: 0
      });
      return;
    }

    // 所有记录都是扣分记录（负分）
    const totalDeduction = records.reduce((sum, record) => sum + Math.abs(record.score), 0);
    const netScore = -totalDeduction; // 净得分就是负的总扣分
    const avgScore = records.reduce((sum, record) => sum + record.score, 0) / records.length;

    setStatistics({
      totalRecords: records.length,
      totalDeduction: Number(totalDeduction.toFixed(1)),
      netScore: Number(netScore.toFixed(1)),
      avgScore: Number(avgScore.toFixed(1))
    });
  };

  const columns: ColumnsType<ScoreRecord> = [
    {
      title: '扣分类型',
      dataIndex: 'deduction_type',
      key: 'deductionType',
      width: 120,
      render: (_, record) => {
        // 根据原因判断扣分类型，与LEARNING_STANDARDS保持一致
        const reason = record.reason || '';
        let type = '其他';
        let color = 'default';
        
        // 按照学习扣分标准进行精确匹配
        if (reason.includes('缺席') && reason.includes('会议')) {
          type = '缺席会议';
          color = 'red';
        } else if (reason.includes('未完成') && (reason.includes('学习任务') || reason.includes('笔记') || reason.includes('心得'))) {
          type = '未完成学习任务';
          color = 'orange';
        } else if (reason.includes('参与率') && (reason.includes('不足') || reason.includes('60%'))) {
          type = '学习活动参与率不足';
          color = 'volcano';
        } else if (reason.includes('学习') || reason.includes('培训') || reason.includes('会议')) {
          // 其他学习相关但不明确分类的记录
          type = '其他学习相关';
          color = 'blue';
        }
        
        return <Tag color={color} className="deduction-type-tag">{type}</Tag>;
      }
    },
    {
      title: '扣分分值',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: (value) => (
        <Tag color="red" className="deduction-score-tag">
          {Math.abs(Number(value))}分
        </Tag>
      ),
      sorter: (a, b) => Math.abs(a.score) - Math.abs(b.score)
    },
    {
      title: '扣分原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span className="deduction-reason">{text}</span>
        </Tooltip>
      )
    },
    {
      title: '扣分时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (date) => (
        <span className="deduction-time">
          {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </span>
      ),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend'
    },
    {
      title: '录入人',
      dataIndex: ['recorder', 'name'],
      key: 'recorder',
      width: 100,
      render: (name) => (
        <span className="deduction-recorder">{name || '系统'}</span>
      )
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

  const handleQuickAdd = (standard: typeof LEARNING_STANDARDS[0]) => {
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
        <Col span={6}>
          <Card>
            <Statistic title="总记录数" value={statistics.totalRecords} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="总扣分" 
              value={statistics.totalDeduction} 
              valueStyle={{ color: '#cf1322' }}
              suffix="分"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="净得分" 
              value={statistics.netScore} 
              valueStyle={{ color: statistics.netScore >= 0 ? '#3f8600' : '#cf1322' }}
              suffix="分"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="平均得分" 
              value={statistics.avgScore} 
              valueStyle={{ color: statistics.avgScore >= 0 ? '#3f8600' : '#cf1322' }}
              suffix="分"
            />
          </Card>
        </Col>
      </Row>

      {/* 学习扣分标准说明 */}
      <Row gutter={16} className="mb-4">
        <Col span={24}>
          <Card 
            size="small" 
            title={<><InfoCircleOutlined className="mr-2 text-red-500" />学习扣分标准</>}
            className="shadow-sm"
          >
            <Row gutter={[20, 20]} className="px-6 py-4">
              {LEARNING_STANDARDS.map((standard, index) => (
                <Col span={8} key={index}>
                  <div className="text-center p-5 bg-red-50 rounded-xl border border-red-100 h-40 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex-shrink-0">
                      <Tag color="red" className="mb-3 text-sm font-medium">
                        {standard.type}
                      </Tag>
                      <div className="text-lg font-bold text-red-600 mb-3">
                        -{Math.abs(standard.score)}分
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed flex-grow flex items-center justify-center px-2">
                      <span className="text-center">{standard.description}</span>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 筛选条件 */}
      <Card className="mb-4" size="small">
        <div className="query-form">
          <Row gutter={16} align="middle">
            {!currentUserId && (
              <Col span={6}>
                <div className="flex items-center">
                  <span className="mr-2">人员筛选：</span>
                  <Select
                    value={selectedUser}
                    onChange={setSelectedUser}
                    placeholder="选择人员"
                    className="flex-1"
                    allowClear
                  >
                    {users.map(user => (
                      <Option key={user.id} value={user.id}>
                        {user.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </Col>
            )}
            <Col span={currentUserId ? 6 : 6}>
              <div className="flex items-center">
                <span className="mr-2">扣分类型：</span>
                <Select
                  value={selectedDeductionType}
                  onChange={setSelectedDeductionType}
                  placeholder="选择扣分类型"
                  className="flex-1"
                  allowClear
                >
                  <Option value="缺席会议">缺席会议</Option>
                  <Option value="未完成学习任务">未完成学习任务</Option>
                  <Option value="学习活动参与率不足">学习活动参与率不足</Option>
                </Select>
              </div>
            </Col>
            <Col span={currentUserId ? 6 : 6}>
              <div className="flex items-center">
                <span className="mr-2">时间范围：</span>
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  placeholder={['开始日期', '结束日期']}
                  className="flex-1"
                />
              </div>
            </Col>
            <Col span={currentUserId ? 6 : 6}>
              <div className="flex justify-end">
                {!readonly && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setModalVisible(true)}
                    className="mr-2"
                  >
                    添加记录
                  </Button>
                )}
                <Button type="primary" onClick={loadData} loading={loading}>
                  查询
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* 数据表格 */}
      <div className="learning-score-table">
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={scoreRecords}
              rowKey="id"
              loading={loading}
              size="middle"
              bordered
              pagination={{
                total: scoreRecords.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条扣分记录`,
                pageSizeOptions: ['10', '20', '50', '100']
              }}
              scroll={{ x: 800 }}
              locale={{
                emptyText: selectedDeductionType 
                  ? `暂无"${selectedDeductionType}"相关的扣分记录` 
                  : '暂无学习扣分记录'
              }}
              rowClassName={(record, index) => 
                index % 2 === 0 ? 'table-row-light' : 'table-row-dark'
              }
            />
          </Spin>
        </div>

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