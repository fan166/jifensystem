import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Spin, DatePicker, Row, Col, Statistic, Tooltip, Alert, Badge, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, ExclamationCircleOutlined, MinusOutlined, BarChartOutlined } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { scoreAPI, scoreTypeAPI, userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Score, ScoreType, User } from '../lib/supabase';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface ScoreRecord extends Score {
  user?: { name: string; email: string };
}

interface DisciplineScoreProps {
  readonly?: boolean;
  currentUserId?: string;
}

// 纪律扣分标准
const DISCIPLINE_STANDARDS = [
  { 
    type: '办公场所清洁卫生及安全节约违规', 
    score: -0.5, 
    description: '保持办公场所清洁卫生，下班前要关闭好办公室的门、窗、柜、水、电及电脑，确保安全和节约，凡违反一次，所有相关责任人每次扣 0.5 分；', 
    severity: 'low' 
  },
  { 
    type: '工作时间非工作状态行为', 
    score: -0.5, 
    description: '工作时间上网聊天、玩游戏、购物、炒股等不在工作状态的每次扣 0.5 分，情节严重者扣 2 分；', 
    severity: 'low',
    severeCases: { score: -2, severity: 'medium' }
  },
  { 
    type: '不遵守机关管理制度', 
    score: -1, 
    description: '不遵守机关各项管理制度如请销假、办事制度、印章管理使用等每例扣 1 分；', 
    severity: 'low' 
  },
  { 
    type: '无故不参加集体活动', 
    score: -1, 
    description: '积极参加市公路中心统一组织的各类活动等，凡无故不参加的每次扣 1 分；', 
    severity: 'low' 
  },
  { 
    type: '不服从组织安排', 
    score: -3, 
    description: '服从组织安排，做好内部协调配合，主动接受领导安排的各项临时性工作任务，凡推诿扯皮、敷衍了事、无故不参加的每次扣 3 分，情节严重者扣 5 分；', 
    severity: 'high',
    severeCases: { score: -5, severity: 'critical' }
  },
  { 
    type: '纪律问题按处分级别', 
    score: -0.5, 
    description: '将纪律挺在前面，因工作、作风、廉政等问题，当年受到市公路中心党委约谈或提醒谈话的每例扣 0.5 分、书面检查每例扣 1 分、通报批评每例扣 2 分、诫勉谈话的每例 扣 3 分、纪律处分的每例扣 5 分。', 
    severity: 'low',
    levels: [
      { type: '约谈或提醒谈话', score: -0.5, severity: 'low' },
      { type: '书面检查', score: -1, severity: 'low' },
      { type: '通报批评', score: -2, severity: 'medium' },
      { type: '诫勉谈话', score: -3, severity: 'high' },
      { type: '纪律处分', score: -5, severity: 'critical' }
    ]
  }
];



// 严重程度颜色映射
const SEVERITY_COLORS = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#fa8c16',
  critical: '#f5222d'
};

const DisciplineScore: React.FC<DisciplineScoreProps> = ({ readonly = false, currentUserId }) => {
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
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const { user: currentUser } = useAuthStore();

  // 统计数据
  const [statistics, setStatistics] = useState({
    totalRecords: 0,
    totalDeduction: 0,
    netScore: 0,
    criticalCount: 0,
    highCount: 0
  });

  // 趋势分析数据
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<'month' | 'quarter'>('month');
  
  // 改善建议状态
  const [improvementSuggestions, setImprovementSuggestions] = useState([]);
  
  // 排序状态
  const [sortedInfo, setSortedInfo] = useState<{ columnKey?: string; order?: 'ascend' | 'descend' }>({ columnKey: 'created_at', order: 'descend' });
  
  // 表格变化处理
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setSortedInfo(sorter);
  };

  useEffect(() => {
    loadData();
  }, [dateRange, selectedUser, severityFilter, currentUserId]);

  // 当趋势周期改变时重新计算趋势数据
  useEffect(() => {
    if (scoreRecords.length > 0) {
      calculateTrendData(scoreRecords);
    }
  }, [trendPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoreTypesData, usersData] = await Promise.all([
        scoreTypeAPI.getScoreTypesByCategory('basic_duty'),
        userAPI.getUsers()
      ]);
      
      // 筛选纪律相关的积分类型
      const disciplineTypes = scoreTypesData.filter(type => 
        type.name.includes('纪律') || type.name.includes('违纪')
      );
      setScoreTypes(disciplineTypes);
      setUsers(usersData);

      // 构建查询条件
      const filters: any = { category: 'basic_duty' };
      // 如果有currentUserId，优先使用它进行过滤
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
      // 只显示纪律相关的记录
      let disciplineRecords = scoresData.filter(record => 
        record.score_type_id.includes('discipline') || record.score_type_id.includes('violation')
      );
      
      // 按严重程度筛选
      if (severityFilter) {
        disciplineRecords = disciplineRecords.filter(record => {
          const standard = DISCIPLINE_STANDARDS.find(s => record.reason?.includes(s.type));
          return standard?.severity === severityFilter;
        });
      }
      
      setScoreRecords(disciplineRecords);
      calculateStatistics(disciplineRecords);
      calculateTrendData(disciplineRecords);
      setImprovementSuggestions(generateImprovementSuggestions(disciplineRecords));
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
  
  
        criticalCount: 0,
        highCount: 0
      });
      return;
    }

    const deductionRecords = records.filter(r => r.score < 0);
    const bonusRecords = records.filter(r => r.score > 0);
    
    const totalDeduction = deductionRecords.reduce((sum, record) => sum + Math.abs(record.score), 0);

    const totalBonus = bonusRecords.reduce((sum, record) => sum + record.score, 0);
    const netScore = totalBonus - totalDeduction;
    const uniqueUsers = new Set(records.map(r => r.user_id)).size;


    // 统计严重违纪情况
    const criticalCount = records.filter(record => {
      const standard = DISCIPLINE_STANDARDS.find(s => record.reason?.includes(s.type));
      return standard?.severity === 'critical';
    }).length;

    const highCount = records.filter(record => {
      const standard = DISCIPLINE_STANDARDS.find(s => record.reason?.includes(s.type));
      return standard?.severity === 'high';
    }).length;

    setStatistics({
      totalRecords: records.length,
      totalDeduction: Number(totalDeduction.toFixed(1)),
      netScore: Number(netScore.toFixed(1)),
      criticalCount,
      highCount
    });
  };

  // 生成个人改善建议
  const generateImprovementSuggestions = (records: ScoreRecord[]) => {
    if (records.length === 0) return [];

    const suggestions = [];
    const recentRecords = records.filter(record => 
      dayjs().diff(dayjs(record.created_at), 'days') <= 30
    );
    
    // 分析最近30天的违纪情况
    const recentCritical = recentRecords.filter(r => {
      const standard = DISCIPLINE_STANDARDS.find(s => r.reason?.includes(s.type));
      return standard?.severity === 'critical';
    }).length;
    const recentHigh = recentRecords.filter(r => {
      const standard = DISCIPLINE_STANDARDS.find(s => r.reason?.includes(s.type));
      return standard?.severity === 'high';
    }).length;
    const totalRecent = recentRecords.length;
    
    // 分析违纪类型频率
    const typeFrequency: Record<string, number> = {};
    recentRecords.forEach(record => {
      const standard = DISCIPLINE_STANDARDS.find(s => record.reason?.includes(s.type));
      if (standard) {
        typeFrequency[standard.type] = (typeFrequency[standard.type] || 0) + 1;
      }
    });
    const mostFrequentType = Object.keys(typeFrequency).reduce((a, b) => 
      typeFrequency[a] > typeFrequency[b] ? a : b, Object.keys(typeFrequency)[0]
    );

    // 生成建议
    if (recentCritical > 0) {
      suggestions.push({
        type: 'urgent',
        title: '紧急关注',
        content: `最近30天内有${recentCritical}次重大违纪，建议立即制定整改计划并接受专项培训。`,
        icon: '🚨',
        color: 'red'
      });
    }

    if (recentHigh >= 2) {
      suggestions.push({
        type: 'warning',
        title: '加强自律',
        content: `最近30天内有${recentHigh}次严重违纪，建议加强自我约束，主动寻求部门指导。`,
        icon: '⚠️',
        color: 'orange'
      });
    }

    if (mostFrequentType && typeFrequency[mostFrequentType] >= 2) {
      suggestions.push({
        type: 'pattern',
        title: '行为模式',
        content: `在"${mostFrequentType}"方面出现${typeFrequency[mostFrequentType]}次违纪，建议针对性改进。`,
        icon: '📊',
        color: 'blue'
      });
    }

    if (totalRecent === 0 && records.length > 0) {
      const lastRecord = records.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const daysSinceLastViolation = dayjs().diff(dayjs(lastRecord.created_at), 'days');
      
      if (daysSinceLastViolation >= 30) {
        suggestions.push({
          type: 'positive',
          title: '表现良好',
          content: `已连续${daysSinceLastViolation}天无违纪记录，请继续保持良好表现！`,
          icon: '🎉',
          color: 'green'
        });
      }
    }

    if (suggestions.length === 0 && totalRecent > 0) {
      suggestions.push({
        type: 'general',
        title: '持续改进',
        content: '建议定期反思工作行为，积极参与培训学习，不断提升自我管理能力。',
        icon: '💡',
        color: 'blue'
      });
    }

    return suggestions;
  };

  // 计算趋势数据
  const calculateTrendData = (records: ScoreRecord[]) => {
    if (records.length === 0) {
      setTrendData([]);
      return;
    }

    // 按时间分组
    const groupedData = records.reduce((acc, record) => {
      const date = dayjs(record.created_at);
      let key: string;
      
      if (trendPeriod === 'month') {
        key = date.format('YYYY-MM');
      } else {
        const quarter = Math.ceil((date.month() + 1) / 3);
        key = `${date.year()}Q${quarter}`;
      }
      
      if (!acc[key]) {
        acc[key] = {
          period: key,
          totalRecords: 0,
          totalDeduction: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        };
      }
      
      acc[key].totalRecords++;
      if (record.score < 0) {
        acc[key].totalDeduction += Math.abs(record.score);
      }
      
      // 统计严重程度
      const standard = DISCIPLINE_STANDARDS.find(s => record.reason?.includes(s.type));
      if (standard) {
        switch (standard.severity) {
          case 'critical':
            acc[key].criticalCount++;
            break;
          case 'high':
            acc[key].highCount++;
            break;
          case 'medium':
            acc[key].mediumCount++;
            break;
          case 'low':
            acc[key].lowCount++;
            break;
        }
      }
      
      return acc;
    }, {} as Record<string, any>);

    // 转换为数组并排序
    const trendArray = Object.values(groupedData).sort((a: any, b: any) => {
      return a.period.localeCompare(b.period);
    });

    setTrendData(trendArray);
  };



  // 响应式列配置
  const getResponsiveColumns = (): ColumnsType<ScoreRecord> => {
    const baseColumns: ColumnsType<ScoreRecord> = [


      {
        title: '违纪时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
        render: (date) => (
          <div className="font-medium">
            <div>{dayjs(date).format('YYYY-MM-DD')}</div>
            <div className="text-xs text-gray-500">{dayjs(date).format('HH:mm')}</div>
          </div>
        ),
        sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        sortOrder: sortedInfo.columnKey === 'created_at' ? sortedInfo.order : null,
        responsive: ['xs', 'sm', 'md', 'lg', 'xl']
      },
      {
        title: '纪律类型',
        dataIndex: 'score_type_id',
        key: 'scoreType',
        width: 150,
        render: (typeId) => <Tag color="orange">{typeId}</Tag>,
        sorter: (a, b) => (a.score_type_id || '').localeCompare(b.score_type_id || ''),
        sortOrder: sortedInfo.columnKey === 'scoreType' ? sortedInfo.order : null,
        responsive: ['md', 'lg', 'xl']
      },
      {
        title: '扣分值',
        dataIndex: 'score',
        key: 'score',
        width: 100,
        render: (value) => (
          <Tag 
            color={Number(value) > 0 ? 'green' : 'red'} 
            className="font-bold text-base"
          >
            {Number(value) > 0 ? '+' : ''}{value}分
          </Tag>
        ),
        sorter: (a, b) => a.score - b.score,
        sortOrder: sortedInfo.columnKey === 'score' ? sortedInfo.order : null,
        responsive: ['xs', 'sm', 'md', 'lg', 'xl']
      },



    ];

    return baseColumns;
  };

  const columns = getResponsiveColumns();

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
      disciplineDate: record.created_at ? dayjs(record.created_at) : dayjs(),
      scoreType: record.score > 0 ? 'bonus' : 'deduction'
    });
    setScoreType(record.score > 0 ? 'bonus' : 'deduction');
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条纪律积分记录吗？',
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
        period: values.disciplineDate ? values.disciplineDate.format('YYYY-MM') : dayjs().format('YYYY-MM')
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

  const handleQuickAdd = (standard: typeof DISCIPLINE_STANDARDS[0]) => {
    form.setFieldsValue({
      score: Math.abs(standard.score),
      reason: `${standard.type}：${standard.description}`,
      scoreType: standard.score > 0 ? 'bonus' : 'deduction'
    });
    setScoreType(standard.score > 0 ? 'bonus' : 'deduction');
  };

  return (
    <div>
      {/* 警告提示 */}
      {(statistics.criticalCount > 0 || statistics.highCount > 0) && (
        <Alert
          message="纪律违规警告"
          description={`发现 ${statistics.criticalCount} 起重大违纪，${statistics.highCount} 起严重违纪，请及时关注和处理。`}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          className="mb-4"
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card>
            <Statistic title="总记录数" value={statistics.totalRecords} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="总扣分" value={statistics.totalDeduction} precision={1} suffix="分" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
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

      </Row>

        {/* 个人改善建议 */}
        {improvementSuggestions.length > 0 && (
          <Card className="mb-6" title="个人改善建议">
            <Row gutter={[16, 16]}>
              {improvementSuggestions.map((suggestion, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <div className={`p-4 rounded-lg border-l-4 ${
                    suggestion.color === 'red' ? 'bg-red-50 border-red-400' :
                    suggestion.color === 'orange' ? 'bg-orange-50 border-orange-400' :
                    suggestion.color === 'blue' ? 'bg-blue-50 border-blue-400' :
                    suggestion.color === 'green' ? 'bg-green-50 border-green-400' :
                    'bg-gray-50 border-gray-400'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{suggestion.icon}</span>
                      <div className="flex-1">
                        <h4 className={`font-medium mb-2 ${
                          suggestion.color === 'red' ? 'text-red-700' :
                          suggestion.color === 'orange' ? 'text-orange-700' :
                          suggestion.color === 'blue' ? 'text-blue-700' :
                          suggestion.color === 'green' ? 'text-green-700' :
                          'text-gray-700'
                        }`}>
                          {suggestion.title}
                        </h4>
                        <p className={`text-sm ${
                          suggestion.color === 'red' ? 'text-red-600' :
                          suggestion.color === 'orange' ? 'text-orange-600' :
                          suggestion.color === 'blue' ? 'text-blue-600' :
                          suggestion.color === 'green' ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          {suggestion.content}
                        </p>
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}



      {/* 纪律积分标准说明 */}
      <Row gutter={16} className="mb-4">
        <Col span={24}>
          <Card size="small" title={<><ExclamationCircleOutlined className="mr-2 text-red-500" />纪律扣分标准</>}>
            <Row gutter={[16, 8]} style={{ alignItems: 'stretch' }}>
              {DISCIPLINE_STANDARDS.map((standard, index) => (
                <Col xs={24} sm={12} md={8} key={index} style={{ display: 'flex' }}>
                  <Card 
                    size="small" 
                    hoverable
                    className="floating-card"
                    style={{ border: '1px solid #d9d9d9', backgroundColor: '#fafafa', borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Space>
                        <Tag color="default">
                          {standard.type}
                        </Tag>
                      </Space>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          标准扣分: <strong>{Math.abs(standard.score)} 分/次</strong>
                        </div>
                        {standard.severeCases && (
                          <div style={{ fontSize: '12px', color: '#cf1322' }}>
                            严重情形: <strong>{Math.abs(standard.severeCases.score)} 分/次</strong>
                          </div>
                        )}
                        {standard.levels && standard.levels.length > 0 && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            分级标准：
                          </div>
                        )}
                        {standard.levels && standard.levels.map((lvl, idx) => (
                          <div key={idx} style={{ fontSize: '12px', color: '#666' }}>
                            <Tag color="default" style={{ marginRight: 8 }}>{lvl.type}</Tag>
                            <strong>{Math.abs(lvl.score)} 分/次</strong>
                          </div>
                        ))}
                      </Space>
                    </div>

                    <div style={{ fontSize: '11px', color: '#999', lineHeight: '1.3' }}>
                      {standard.description}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <style>{`
        .floating-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .floating-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
      `}</style>



      {/* 数据表格 */}
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={scoreRecords}
          rowKey="id"
          onChange={handleTableChange}

          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: window.innerWidth > 768,
            showTotal: (total, range) => {
              if (window.innerWidth < 576) {
                return `${range[0]}-${range[1]}/${total}`;
              }
              return `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`;
            }
          }}
          scroll={{ x: 'max-content', y: window.innerHeight > 800 ? 600 : 400 }}
          size={window.innerWidth < 768 ? 'small' : 'middle'}
        />
      </Spin>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑纪律积分' : '添加纪律积分'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
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
                label="纪律类型"
                rules={[{ required: true, message: '请选择纪律类型' }]}
              >
                <Select placeholder="请选择纪律类型">
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
                  max={10}
                  step={0.1}
                  precision={1}
                  className="w-full"
                  addonAfter="分"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="disciplineDate"
                label="违纪日期"
                rules={[{ required: true, message: '请选择违纪日期' }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="reason"
            label="违纪原因"
            rules={[{ required: true, message: '请输入违纪原因' }]}
          >
            <TextArea
              placeholder="请详细描述违纪情况和处理依据"
              rows={4}
            />
          </Form.Item>

          {/* 快速选择标准 */}
          <Form.Item label="快速选择">
            <div className="mb-3">
              <span className="text-sm font-medium text-red-600">扣分标准：</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DISCIPLINE_STANDARDS.map((standard, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => handleQuickAdd(standard)}
                    className="text-left h-auto py-2"
                    danger={standard.severity === 'critical' || standard.severity === 'high'}
                    type={standard.severity === 'critical' ? 'primary' : 'default'}
                  >
                    <div>
                      <div className="font-medium">{standard.type} ({Math.abs(standard.score)} 分)</div>
                      <div className="text-xs opacity-75">{standard.description}</div>
                    </div>
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

export default DisciplineScore;
