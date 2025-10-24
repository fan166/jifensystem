import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Spin, DatePicker, Row, Col, Statistic, Tooltip, Progress, Badge, Tabs, Empty, Timeline, Avatar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined, ArrowUpOutlined, ArrowDownOutlined, UserOutlined, CalendarOutlined, FilterOutlined, BarChartOutlined, TableOutlined, DownloadOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
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

interface AttendanceScoreProps {
  readonly?: boolean;
  currentUserId?: string; // 当前用户ID，用于权限控制
}

// 考勤扣分标准
const ATTENDANCE_STANDARDS = [
  { type: '迟到、早退（含值班）', score: -0.5, description: '迟到、早退（含值班）的每次扣0.5分' },
  { type: '旷工或联系不上', score: -1, description: '旷工或上班时间联系不上的每次扣1分' },
  { type: '检查时无故不在岗', score: -1, description: '检查时无故不在岗（含上级抽查等）的每次扣1分' },
  { type: '明知任务仍联系不上', score: -3, description: '明知有工作任务或事前有通知的情况下仍然联系不上的每次扣3分' },
  { type: '事假超公休假', score: -1, description: '全年请事假（不含婚假、产假、病假）超过公休假的每多一天扣1分' },
  { type: '累计或连续旷工', score: -10, description: '一年内累计旷工超过7天的，或连续旷工超过3天的扣10分' }
];

const AttendanceScore: React.FC<AttendanceScoreProps> = ({ readonly = false, currentUserId }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ScoreRecord | null>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [scoreRecords, setScoreRecords] = useState<ScoreRecord[]>([]);
  const [scoreTypes, setScoreTypes] = useState<ScoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const { user: currentUser } = useAuthStore();

  // 统计数据
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    totalDeduction: 0,
    avgDeduction: 0,
    mostCommonType: ''
  });

  // 分类统计数据
  const [categoryStats, setCategoryStats] = useState<{
    [key: string]: {
      count: number;
      totalScore: number;
      records: ScoreRecord[];
      trend: 'up' | 'down' | 'stable';
    }
  }>({});

  // 筛选和排序状态
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
      
      // 筛选考勤相关的积分类型
      const attendanceTypes = scoreTypesData.filter(type => 
        type.name.includes('考勤') || type.name.includes('出勤')
      );
      setScoreTypes(attendanceTypes);
      setUsers(usersData);

      // 构建查询条件
      const filters: any = { category: 'basic_duty' };
      
      // 如果是普通职工，只查询自己的记录
      if (currentUserId) {
        filters.userId = currentUserId;
      } else if (selectedUser) {
        filters.userId = selectedUser;
      }
      
      if (dateRange) {
        filters.startDate = dateRange[0].format('YYYY-MM-DD');
        filters.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const scoresData = await scoreAPI.getScores(filters);
      // 只显示考勤相关的记录
      const attendanceRecords = scoresData.filter(record => 
        record.score_type_id.includes('attendance') || record.score_type_id.includes('punctuality')
      );
      
      setScoreRecords(attendanceRecords);
      calculateStatistics(attendanceRecords);
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
        avgDeduction: 0,
        mostCommonType: ''
      });
      setCategoryStats({});
      return;
    }

    const totalDeduction = records.reduce((sum, record) => sum + Math.abs(record.score), 0);
    const avgDeduction = totalDeduction / records.length;
    
    // 统计最常见的扣分类型
    const typeCount: { [key: string]: number } = {};
    records.forEach(record => {
      const typeName = record.score_type_id || '';
      typeCount[typeName] = (typeCount[typeName] || 0) + 1;
    });
    
    const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
      typeCount[a] > typeCount[b] ? a : b, ''
    );

    setStatistics({
      totalRecords: records.length,
      totalDeduction: Number(totalDeduction.toFixed(1)),
      avgDeduction: Number(avgDeduction.toFixed(1)),
      mostCommonType
    });

    // 按扣分标准分类统计
    const categoryData: { [key: string]: { count: number; totalScore: number; records: ScoreRecord[]; trend: 'up' | 'down' | 'stable' } } = {};
    
    ATTENDANCE_STANDARDS.forEach(standard => {
      const relatedRecords = records.filter(record => 
        record.reason?.includes(standard.type) || 
        Math.abs(record.score) === Math.abs(standard.score)
      );
      
      if (relatedRecords.length > 0) {
        const totalScore = relatedRecords.reduce((sum, record) => sum + Math.abs(record.score), 0);
        
        // 计算趋势（简单的月度对比）
        const currentMonth = dayjs().format('YYYY-MM');
        const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
        const currentMonthRecords = relatedRecords.filter(r => dayjs(r.created_at).format('YYYY-MM') === currentMonth);
        const lastMonthRecords = relatedRecords.filter(r => dayjs(r.created_at).format('YYYY-MM') === lastMonth);
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (currentMonthRecords.length > lastMonthRecords.length) {
          trend = 'up';
        } else if (currentMonthRecords.length < lastMonthRecords.length) {
          trend = 'down';
        }
        
        categoryData[standard.type] = {
          count: relatedRecords.length,
          totalScore,
          records: relatedRecords,
          trend
        };
      }
    });
    
    setCategoryStats(categoryData);
  };

  const columns: ColumnsType<ScoreRecord> = [];

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
      score: Math.abs(record.score), // 显示正数，用户输入时更直观
      reason: record.reason,
      attendanceDate: record.created_at ? dayjs(record.created_at) : dayjs()
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条考勤扣分记录吗？',
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
      const scoreData = {
        user_id: values.userId,
        score_type_id: values.scoreTypeId,
        score: -Math.abs(values.score), // 考勤扣分，存储为负数
        reason: values.reason,
        recorder_id: currentUser?.id,
        period: values.attendanceDate ? values.attendanceDate.format('YYYY-MM') : dayjs().format('YYYY-MM')
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

  const handleQuickAdd = (standard: typeof ATTENDANCE_STANDARDS[0]) => {
    form.setFieldsValue({
      score: Math.abs(standard.score),
      reason: `${standard.type}：${standard.description}`
    });
  };

  // 筛选和排序处理
  const getFilteredAndSortedRecords = () => {
    let filtered = scoreRecords;
    
    // 按类型筛选
    if (filterType !== 'all') {
      filtered = scoreRecords.filter(record => 
        record.reason?.includes(filterType) || 
        (categoryStats[filterType] && categoryStats[filterType].records.some(r => r.id === record.id))
      );
    }
    
    // 排序
    return filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.created_at || '').getTime();
          bValue = new Date(b.created_at || '').getTime();
          break;
        case 'score':
          aValue = Math.abs(a.score);
          bValue = Math.abs(b.score);
          break;
        case 'type':
          aValue = a.reason || '';
          bValue = b.reason || '';
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const filteredRecords = getFilteredAndSortedRecords();

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic 
              title="扣分记录数" 
              value={statistics.totalRecords} 
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="总扣分" 
              value={statistics.totalDeduction} 
              precision={1} 
              suffix="分" 
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic 
              title="平均扣分" 
              value={statistics.avgDeduction} 
              precision={1} 
              suffix="分" 
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和排序控制 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          {!currentUserId && (
            <Col span={6}>
              <div>
                <span style={{ marginRight: 8 }}>人员筛选：</span>
                <Select
                  placeholder="选择人员"
                  allowClear
                  value={selectedUser}
                  onChange={setSelectedUser}
                  showSearch
                  optionFilterProp="children"
                  style={{ width: '100%' }}
                >
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>{user.name}</Option>
                  ))}
                </Select>
              </div>
            </Col>
          )}
          <Col span={currentUserId ? 6 : 5}>
            <div>
              <span style={{ marginRight: 8 }}>时间范围：</span>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
              />
            </div>
          </Col>
          <Col span={currentUserId ? 4 : 4}>
            <div>
              <span style={{ marginRight: 8 }}>类型筛选：</span>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: '100%' }}
              >
                <Option value="all">全部类型</Option>
                {ATTENDANCE_STANDARDS.map(standard => (
                  <Option key={standard.type} value={standard.type}>
                    {standard.type}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col span={currentUserId ? 4 : 3}>
            <div>
              <span style={{ marginRight: 8 }}>排序：</span>
              <Select
                value={`${sortBy}-${sortOrder}`}
                onChange={(value) => {
                  const [by, order] = value.split('-');
                  setSortBy(by as 'date' | 'score' | 'type');
                  setSortOrder(order as 'asc' | 'desc');
                }}
                style={{ width: '100%' }}
              >
                <Option value="date-desc">时间↓</Option>
                <Option value="date-asc">时间↑</Option>
                <Option value="score-desc">扣分↓</Option>
                <Option value="score-asc">扣分↑</Option>
                <Option value="type-asc">类型A-Z</Option>
              </Select>
            </div>
          </Col>
          <Col span={currentUserId ? 10 : 6}>
            <div style={{ textAlign: 'right' }}>
              {!readonly && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  添加考勤扣分
                </Button>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 分类扣分详情卡片 */}
      <Card 
        title={
          <Space>
            <InfoCircleOutlined />
            <span>考勤扣分详情分析</span>
            <Badge count={Object.keys(categoryStats).length} showZero color="#108ee9" />
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[16, 16]}>
          {ATTENDANCE_STANDARDS.map((standard, index) => {
            const categoryData = categoryStats[standard.type];
            const hasData = categoryData && categoryData.count > 0;
            
            return (
              <Col span={8} key={index}>
                <Card 
                  size="small" 
                  hoverable
                  style={{ 
                    border: hasData ? '1px solid #ff7875' : '1px solid #d9d9d9',
                    backgroundColor: hasData ? '#fff2f0' : '#fafafa'
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Space>
                      <Tag color={hasData ? "red" : "default"}>
                        {standard.type}
                      </Tag>
                      {hasData && (
                        <Badge 
                          count={categoryData.count} 
                          style={{ backgroundColor: '#ff4d4f' }}
                        />
                      )}
                      {hasData && categoryData.trend !== 'stable' && (
                         <Tooltip title={`相比上月${categoryData.trend === 'up' ? '增加' : '减少'}`}>
                           {categoryData.trend === 'up' ? 
                             <ArrowUpOutlined style={{ color: '#ff4d4f' }} /> : 
                             <ArrowDownOutlined style={{ color: '#52c41a' }} />
                           }
                         </Tooltip>
                       )}
                    </Space>
                  </div>
                  
                  <div style={{ marginBottom: 8 }}>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        标准扣分: <strong>{Math.abs(standard.score)}分/次</strong>
                      </div>
                      {hasData && (
                        <>
                          <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                            实际扣分: <strong>{categoryData.totalScore.toFixed(1)}分</strong>
                          </div>
                          <Progress 
                            percent={Math.min((categoryData.count / 10) * 100, 100)} 
                            size="small" 
                            status={categoryData.count > 5 ? 'exception' : 'normal'}
                            showInfo={false}
                          />
                        </>
                      )}
                    </Space>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#999', lineHeight: '1.3' }}>
                    {standard.description}
                  </div>
                  
                  {hasData && (
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <Button 
                        type="link" 
                        size="small" 
                        onClick={() => setFilterType(standard.type)}
                        style={{ padding: 0, fontSize: '11px' }}
                      >
                        查看详情 ({categoryData.count}条)
                      </Button>
                    </div>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
        
        {/* 趋势时间线 */}
        {Object.keys(categoryStats).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 12 }}>
              <CalendarOutlined /> 最近扣分记录时间线
            </h4>
            <Timeline mode="left" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filteredRecords.slice(0, 10).map((record, index) => {
                const isHighScore = Math.abs(record.score) >= 3;
                return (
                  <Timeline.Item 
                    key={record.id}
                    color={isHighScore ? 'red' : 'orange'}
                    dot={isHighScore ? <Avatar size="small" style={{ backgroundColor: '#ff4d4f' }}>{Math.abs(record.score)}</Avatar> : undefined}
                  >
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 'bold', color: isHighScore ? '#ff4d4f' : '#fa8c16' }}>
                        {record.user?.name} - 扣{Math.abs(record.score)}分
                      </div>
                      <div style={{ color: '#666', marginTop: 2 }}>
                        {record.reason}
                      </div>
                      <div style={{ color: '#999', fontSize: '11px', marginTop: 2 }}>
                        {dayjs(record.created_at).format('MM-DD HH:mm')}
                      </div>
                    </div>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </div>
        )}
      </Card>

      {/* 数据表格 */}
      <Card 
        title={
          <Space>
            <TableOutlined />
            <span>扣分记录详情</span>
            <Badge count={filteredRecords.length} showZero color="#ff4d4f" />
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Button 
              type="primary" 
              size="small" 
              icon={<DownloadOutlined />}
              onClick={() => {
                // 导出功能
                const csvContent = filteredRecords.map(record => 
                  `${dayjs(record.created_at).format('YYYY-MM-DD HH:mm')},${record.user?.name || ''},${record.reason},${record.score}`
                ).join('\n');
                const blob = new Blob([`日期,姓名,扣分原因,扣分值\n${csvContent}`], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `考勤扣分记录_${dayjs().format('YYYY-MM-DD')}.csv`;
                link.click();
              }}
            >
              导出
            </Button>
            <Button 
              size="small" 
              icon={<ReloadOutlined />}
              onClick={loadData}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {filteredRecords.length > 0 ? (
          <Table
            dataSource={filteredRecords}
            columns={[
              {
                title: '日期',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 120,
                sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
                render: (date) => (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {dayjs(date).format('MM-DD')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {dayjs(date).format('HH:mm')}
                    </div>
                  </div>
                ),
              },
              {
                title: '员工',
                dataIndex: ['user', 'name'],
                key: 'user_name',
                width: 100,
                render: (name, record) => (
                  <div>
                    <Avatar size="small" style={{ backgroundColor: '#87d068' }}>
                      {name?.charAt(0) || 'U'}
                    </Avatar>
                    <span style={{ marginLeft: 8 }}>{name || '未知'}</span>
                  </div>
                ),
              },
              {
                title: '扣分类型',
                dataIndex: 'reason',
                key: 'type',
                width: 120,
                render: (reason) => {
                  const standard = ATTENDANCE_STANDARDS.find(s => 
                    reason?.includes(s.type) || reason?.includes(s.description)
                  );
                  return (
                    <Tag color={standard ? 'red' : 'orange'}>
                      {standard?.type || '其他'}
                    </Tag>
                  );
                },
              },
              {
                title: '扣分原因',
                dataIndex: 'reason',
                key: 'reason',
                ellipsis: {
                  showTitle: false,
                },
                render: (reason) => (
                  <Tooltip placement="topLeft" title={reason}>
                    <span style={{ fontSize: '12px' }}>{reason}</span>
                  </Tooltip>
                ),
              },
              {
                title: '扣分值',
                dataIndex: 'score',
                key: 'score',
                width: 80,
                align: 'center',
                sorter: (a, b) => Math.abs(a.score) - Math.abs(b.score),
                render: (score) => {
                  const absScore = Math.abs(score);
                  const isHigh = absScore >= 3;
                  return (
                    <div style={{ 
                      color: isHigh ? '#ff4d4f' : '#fa8c16',
                      fontWeight: 'bold',
                      fontSize: isHigh ? '14px' : '12px'
                    }}>
                      -{absScore}
                    </div>
                  );
                },
              },
              ...(!readonly ? [{
                 title: '操作',
                 key: 'action',
                 width: 120,
                 fixed: 'right' as const,
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
                 ),
               }] : [])
            ]}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
            }}
            loading={loading}
            size="small"
            scroll={{ x: 800 }}
            rowKey="id"
          />
        ) : (
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical">
                <span>暂无扣分记录</span>
                <Button type="primary" size="small" onClick={loadData}>
                  重新加载
                </Button>
              </Space>
            }
          />
        )}
      </Card>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑考勤扣分' : '添加考勤扣分'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
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
                label="考勤类型"
                rules={[{ required: true, message: '请选择考勤类型' }]}
              >
                <Select placeholder="请选择考勤类型">
                  {scoreTypes.map(type => (
                    <Option key={type.id} value={type.id}>{type.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="score"
                label="扣分值"
                rules={[{ required: true, message: '请输入扣分值' }]}
              >
                <InputNumber
                  placeholder="请输入扣分值"
                  min={0}
                  max={5}
                  step={0.1}
                  precision={1}
                  addonAfter="分"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="attendanceDate"
                label="考勤日期"
                rules={[{ required: true, message: '请选择考勤日期' }]}
              >
                <DatePicker />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label="扣分原因"
            rules={[{ required: true, message: '请输入扣分原因' }]}
          >
            <TextArea
              placeholder="请输入扣分原因"
              rows={3}
            />
          </Form.Item>

          {/* 快速选择扣分标准 */}
          <Form.Item label="快速选择">
            <div>
              {ATTENDANCE_STANDARDS.map((standard, index) => (
                <Button
                  key={index}
                  size="small"
                  onClick={() => handleQuickAdd(standard)}
                >
                  {standard.type} ({Math.abs(standard.score)}分)
                </Button>
              ))}
            </div>
          </Form.Item>

          <Form.Item>
            <Space>
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

export default AttendanceScore;