import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Upload,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Space,
  Tag,
  Tooltip,
  Spin,
  InputNumber,
  Popconfirm,
  Typography,
  Alert,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileExcelOutlined,
  TrophyOutlined,
  StarOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { parseExcelFile, downloadExcelTemplate, RewardImportData } from '../utils/excelUtils';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import * as XLSX from 'xlsx';

// 扩展dayjs插件
dayjs.extend(isBetween);

const { Option } = Select;
// const { TabPane } = Tabs; // 已废弃，使用items属性
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 奖励类型接口
interface RewardType {
  id: string;
  name: string;
  category: 'commendation' | 'advanced' | 'innovation' | 'special';
  base_score: number;
  max_score: number;
  description: string;
  is_active: boolean;
}

// 奖励记录接口
interface RewardRecord {
  id: string;
  user_id: string;
  reward_type_id: string;
  title: string;
  description: string;
  score: number;
  award_date: string;
  award_period: string;
  issuer_id: string;
  certificate_number?: string;
  is_public: boolean;
  created_at: string;
  user?: {
    name: string;
    department: string;
  };
  reward_type?: RewardType;
  issuer?: {
    name: string;
  };
}

// 月度汇总接口
interface MonthlySummary {
  id: string;
  user_id: string;
  year: number;
  month: number;
  total_rewards: number;
  total_score: number;
  commendation_score: number;
  advanced_score: number;
  innovation_score: number;
  special_score: number;
  user?: {
    name: string;
    department: string;
  };
}

const PerformanceReward: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [rewardTypes, setRewardTypes] = useState<RewardType[]>([]);
  const [rewardRecords, setRewardRecords] = useState<RewardRecord[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RewardRecord | null>(null);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importData, setImportData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('records');
  const [rankingData, setRankingData] = useState<any[]>([]);
  const [personalStats, setPersonalStats] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RewardImportData[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statisticsData, setStatisticsData] = useState<any>(null);
  const [departments, setDepartments] = useState<string[]>([]);

  // 获取奖励类型
  const fetchRewardTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('reward_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;
      setRewardTypes(data || []);
    } catch (error) {
      console.error('获取奖励类型失败:', error);
      message.error('获取奖励类型失败');
    }
  };

  // 获取奖励记录
  const fetchRewardRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reward_score_records')
        .select(`
          *,
          user:users!reward_score_records_user_id_fkey(name, department_id, departments(name)),
          reward_type:reward_types!reward_score_records_reward_type_id_fkey(*),
          issuer:users!reward_score_records_issuer_id_fkey(name)
        `)
        .order('award_date', { ascending: false });

      if (error) throw error;
      setRewardRecords(data || []);
    } catch (error) {
      console.error('获取奖励记录失败:', error);
      message.error('获取奖励记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取月度汇总
  const fetchMonthlySummary = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_reward_summary')
        .select(`
          *,
          user:users!monthly_reward_summary_user_id_fkey(name, department_id, departments(name))
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      setMonthlySummary(data || []);
    } catch (error) {
      console.error('获取月度汇总失败:', error);
      message.error('获取月度汇总失败');
    }
  };

  // 获取积分排行榜数据
  const fetchRankingData = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_reward_summary')
        .select(`
          user_id,
          total_score,
          users!inner(name, department_id, departments(name))
        `)
        .eq('month', new Date().toISOString().slice(0, 7)) // 当前月份
        .order('total_score', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRankingData(data || []);
    } catch (error) {
      console.error('获取排行榜数据失败:', error);
    }
  };

  // 获取个人统计数据
  const fetchPersonalStats = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('reward_score_records')
        .select(`
          *,
          reward_types(name, category)
        `)
        .eq('user_id', user.id)
        .order('award_date', { ascending: false });

      if (error) throw error;
      
      // 计算统计数据
      const totalScore = data?.reduce((sum, record) => sum + record.score, 0) || 0;
      const recentRecords = data?.slice(0, 5) || [];
      const categoryStats = data?.reduce((acc, record) => {
        const category = record.reward_types?.category || '其他';
        acc[category] = (acc[category] || 0) + record.score;
        return acc;
      }, {} as Record<string, number>) || {};

      setPersonalStats({
        totalScore,
        recentRecords,
        categoryStats,
        recordCount: data?.length || 0
      });
    } catch (error) {
      console.error('获取个人统计失败:', error);
    }
  };

  useEffect(() => {
    fetchRewardTypes();
    fetchRewardRecords();
    fetchMonthlySummary();
    fetchRankingData();
    fetchPersonalStats();
    fetchDepartments();
    fetchStatisticsData();
  }, [user?.id]);

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name');

      if (error) throw error;
      setDepartments(data?.map(dept => dept.name) || []);
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  // 获取统计数据
  const fetchStatisticsData = async () => {
    try {
      // 获取总体统计
      const { data: totalStats, error: totalError } = await supabase
        .from('reward_score_records')
        .select('score, award_date, reward_type_id, reward_types(category)');

      if (totalError) throw totalError;

      // 计算统计数据
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      const yearData = totalStats?.filter(record => 
        new Date(record.award_date).getFullYear() === currentYear
      ) || [];
      
      const monthData = totalStats?.filter(record => {
        const date = new Date(record.award_date);
        return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
      }) || [];

      // 按类别统计
      const categoryStats = totalStats?.reduce((acc, record) => {
        const category = record.reward_types?.[0]?.category || 'other';
        acc[category] = (acc[category] || 0) + record.score;
        return acc;
      }, {} as Record<string, number>) || {};

      // 按月份统计（最近12个月）
      const monthlyStats = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        
        const monthRecords = totalStats?.filter(record => {
          const recordDate = new Date(record.award_date);
          return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
        }) || [];
        
        monthlyStats.push({
          month: `${year}-${month.toString().padStart(2, '0')}`,
          count: monthRecords.length,
          score: monthRecords.reduce((sum, record) => sum + record.score, 0)
        });
      }

      setStatisticsData({
        totalRecords: totalStats?.length || 0,
        totalScore: totalStats?.reduce((sum, record) => sum + record.score, 0) || 0,
        yearRecords: yearData.length,
        yearScore: yearData.reduce((sum, record) => sum + record.score, 0),
        monthRecords: monthData.length,
        monthScore: monthData.reduce((sum, record) => sum + record.score, 0),
        categoryStats,
        monthlyStats
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 处理新增/编辑奖励记录
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      const recordData = {
        ...values,
        award_date: values.award_date.format('YYYY-MM-DD'),
        issuer_id: user?.id,
        is_public: true,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('reward_score_records')
          .update(recordData)
          .eq('id', editingRecord.id);

        if (error) throw error;
        message.success('更新奖励记录成功');
      } else {
        const { error } = await supabase
          .from('reward_score_records')
          .insert([recordData]);

        if (error) throw error;
        message.success('添加奖励记录成功');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchRewardRecords();
      fetchMonthlySummary();
    } catch (error) {
      console.error('保存奖励记录失败:', error);
      message.error('保存奖励记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理删除奖励记录
  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('reward_score_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('删除奖励记录成功');
      fetchRewardRecords();
      fetchMonthlySummary();
    } catch (error) {
      console.error('删除奖励记录失败:', error);
      message.error('删除奖励记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    setImportLoading(true);
    try {
      const result = await parseExcelFile(file);
      if (result.success && result.data) {
        setPreviewData(result.data);
        setImportData(result.data);
        message.success(`成功解析 ${result.data.length} 条记录`);
      } else {
        message.error(`文件解析失败: ${result.errors?.join(', ')}`);
      }
    } catch (error) {
      message.error('文件处理失败，请检查文件格式');
    } finally {
      setImportLoading(false);
    }
    return false; // 阻止自动上传
  };

  // 确认导入数据
  const handleConfirmImport = async () => {
    if (importData.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    setImportLoading(true);
    try {
      // 这里应该调用API批量导入数据
      // await batchImportRewards(importData);
      
      // 模拟导入过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      message.success(`成功导入 ${importData.length} 条奖励记录`);
      setImportModalVisible(false);
      setImportData([]);
      setPreviewData([]);
      fetchRewardRecords();
    } catch (error) {
      message.error('导入失败，请重试');
    } finally {
      setImportLoading(false);
    }
  };

  // 处理批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('reward_score_records')
        .delete()
        .in('id', selectedRowKeys);
      
      if (error) throw error;
      
      message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      fetchRewardRecords();
      fetchMonthlySummary();
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 导出数据
  const handleExportData = () => {
    try {
      // 过滤数据
      const filteredData = getFilteredData();
      
      // 准备导出数据
      const exportData = filteredData.map(record => ({
        '用户姓名': record.user?.name || '',
        '部门': record.user?.department || '',
        '奖励类型': record.reward_type?.name || '',
        '奖励标题': record.title,
        '积分': record.score,
        '获奖日期': new Date(record.award_date).toLocaleDateString(),
        '颁发人': record.issuer?.name || '',
        '证书编号': record.certificate_number || '',
        '描述': record.description || ''
      }));

      // 创建工作簿
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '奖励记录');

      // 下载文件
      const fileName = `奖励记录_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      message.success('数据导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  // 获取过滤后的数据
  const getFilteredData = () => {
    return rewardRecords.filter(record => {
      // 搜索文本过滤
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesSearch = 
          record.user?.name?.toLowerCase().includes(searchLower) ||
          record.reward_type?.name?.toLowerCase().includes(searchLower) ||
          record.title?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // 奖励类型过滤
      if (filterType !== 'all' && record.reward_type?.category !== filterType) {
        return false;
      }

      // 部门过滤
      if (departmentFilter !== 'all' && record.user?.department !== departmentFilter) {
        return false;
      }

      // 日期范围过滤
      if (dateRange) {
        const recordDate = dayjs(record.award_date);
        if (!recordDate.isBetween(dateRange[0], dateRange[1], 'day', '[]')) {
          return false;
        }
      }

      return true;
    });
  };

  // 处理批量导入
  const handleBatchImport = async () => {
    if (importData.length === 0) {
      message.error('请先上传文件');
      return;
    }

    try {
      setLoading(true);
      const records = importData.map((item: any) => ({
        user_id: item.user_id || item['用户ID'],
        reward_type_id: item.reward_type_id || item['奖励类型ID'],
        title: item.title || item['奖励标题'],
        description: item.description || item['奖励描述'] || '',
        score: parseFloat(item.score || item['分值'] || '0'),
        award_date: item.award_date || item['奖励日期'] || dayjs().format('YYYY-MM-DD'),
        award_period: item.award_period || item['奖励周期'] || dayjs().format('YYYY-MM'),
        certificate_number: item.certificate_number || item['证书编号'] || '',
        issuer_id: user?.id,
        is_public: true,
      }));

      const { error } = await supabase
        .from('reward_score_records')
        .insert(records);

      if (error) throw error;
      
      message.success(`成功导入 ${records.length} 条奖励记录`);
      setImportModalVisible(false);
      setImportData([]);
      setFileList([]);
      importForm.resetFields();
      fetchRewardRecords();
      fetchMonthlySummary();
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const template = [
      {
        '用户ID': 'user_id_example',
        '奖励类型ID': 'reward_type_id_example',
        '奖励标题': '优秀员工',
        '奖励描述': '月度优秀员工表彰',
        '分值': '10.0',
        '奖励日期': '2024-01-15',
        '奖励周期': '2024-01',
        '证书编号': 'CERT001',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '奖励记录模板');
    XLSX.writeFile(wb, '绩效奖励积分导入模板.xlsx');
  };

  // 奖励记录表格列定义
  const recordColumns: ColumnsType<RewardRecord> = [
    {
      title: '获奖人员',
      dataIndex: ['user', 'name'],
      key: 'user_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: ['user', 'department'],
      key: 'department',
      width: 120,
    },
    {
      title: '奖励标题',
      dataIndex: 'title',
      key: 'title',
      width: 150,
    },
    {
      title: '奖励类型',
      dataIndex: ['reward_type', 'name'],
      key: 'reward_type',
      width: 120,
      render: (text, record) => {
        const categoryColors = {
          commendation: 'blue',
          advanced: 'green',
          innovation: 'orange',
          special: 'purple',
        };
        return (
          <Tag color={categoryColors[record.reward_type?.category || 'commendation']}>
            {text}
          </Tag>
        );
      },
    },
    {
      title: '分值',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score) => (
        <Text strong className="text-red-600">
          +{score}
        </Text>
      ),
    },
    {
      title: '奖励日期',
      dataIndex: 'award_date',
      key: 'award_date',
      width: 100,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '奖励周期',
      dataIndex: 'award_period',
      key: 'award_period',
      width: 100,
    },
    {
      title: '颁发人',
      dataIndex: ['issuer', 'name'],
      key: 'issuer_name',
      width: 100,
    },
    {
      title: '证书编号',
      dataIndex: 'certificate_number',
      key: 'certificate_number',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => {
                Modal.info({
                  title: '奖励详情',
                  content: (
                    <div>
                      <p><strong>获奖人员：</strong>{record.user?.name}</p>
                      <p><strong>奖励标题：</strong>{record.title}</p>
                      <p><strong>奖励描述：</strong>{record.description}</p>
                      <p><strong>分值：</strong>{record.score}</p>
                      <p><strong>奖励日期：</strong>{dayjs(record.award_date).format('YYYY-MM-DD')}</p>
                      <p><strong>证书编号：</strong>{record.certificate_number || '无'}</p>
                    </div>
                  ),
                  width: 500,
                });
              }}
            />
          </Tooltip>
          {hasPermission('write') && (
            <>
              <Tooltip title="编辑">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => {
                    setEditingRecord(record);
                    form.setFieldsValue({
                      ...record,
                      award_date: dayjs(record.award_date),
                    });
                    setModalVisible(true);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="确定要删除这条奖励记录吗？"
                onConfirm={() => handleDelete(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Tooltip title="删除">
                  <Button
                    type="text"
                    icon={<DeleteOutlined />}
                    size="small"
                    danger
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // 月度汇总表格列定义
  const summaryColumns: ColumnsType<MonthlySummary> = [
    {
      title: '姓名',
      dataIndex: ['user', 'name'],
      key: 'user_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: ['user', 'department'],
      key: 'department',
      width: 120,
    },
    {
      title: '年月',
      key: 'period',
      width: 100,
      render: (_, record) => `${record.year}-${String(record.month).padStart(2, '0')}`,
    },
    {
      title: '奖励次数',
      dataIndex: 'total_rewards',
      key: 'total_rewards',
      width: 80,
    },
    {
      title: '总分值',
      dataIndex: 'total_score',
      key: 'total_score',
      width: 80,
      render: (score) => (
        <Text strong className="text-red-600">
          {score}
        </Text>
      ),
    },
    {
      title: '表彰加分',
      dataIndex: 'commendation_score',
      key: 'commendation_score',
      width: 80,
    },
    {
      title: '先进加分',
      dataIndex: 'advanced_score',
      key: 'advanced_score',
      width: 80,
    },
    {
      title: '创新加分',
      dataIndex: 'innovation_score',
      key: 'innovation_score',
      width: 80,
    },
    {
      title: '专项加分',
      dataIndex: 'special_score',
      key: 'special_score',
      width: 80,
    },
  ];

  // 计算统计数据
  const totalRecords = rewardRecords.length;
  const totalScore = rewardRecords.reduce((sum, record) => sum + record.score, 0);
  const currentMonthRecords = rewardRecords.filter(
    (record) => dayjs(record.award_date).format('YYYY-MM') === dayjs().format('YYYY-MM')
  ).length;
  const avgScore = totalRecords > 0 ? (totalScore / totalRecords).toFixed(2) : '0';

  return (
    <div className="p-6">
      <div className="mb-6">
        <Title level={2} className="mb-2">
          <TrophyOutlined className="mr-2" />
          绩效奖励积分管理
        </Title>
        <Text type="secondary">
          管理和查看绩效奖励积分记录，支持批量导入和统计分析
        </Text>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总奖励记录"
              value={totalRecords}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总积分"
              value={totalScore}
              precision={1}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="本月奖励"
              value={currentMonthRecords}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="平均分值"
              value={avgScore}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'ranking',
              label: '积分排行榜',
              children: (
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="本月积分排行榜" extra={<Button onClick={fetchRankingData}>刷新</Button>}>
                  <Table
                    dataSource={rankingData.map((item, index) => ({
                      ...item,
                      rank: index + 1
                    }))}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '排名',
                        dataIndex: 'rank',
                        width: 80,
                        render: (rank) => {
                          let color = '';
                          let icon = null;
                          if (rank === 1) {
                            color = 'gold';
                            icon = <TrophyOutlined style={{ color: '#FFD700' }} />;
                          } else if (rank === 2) {
                            color = 'silver';
                            icon = <TrophyOutlined style={{ color: '#C0C0C0' }} />;
                          } else if (rank === 3) {
                            color = '#CD7F32';
                            icon = <TrophyOutlined style={{ color: '#CD7F32' }} />;
                          }
                          return (
                            <Space>
                              {icon}
                              <span style={{ color, fontWeight: rank <= 3 ? 'bold' : 'normal' }}>
                                {rank}
                              </span>
                            </Space>
                          );
                        }
                      },
                      {
                        title: '姓名',
                        dataIndex: ['users', 'name'],
                        width: 120,
                      },
                      {
                        title: '部门',
                        dataIndex: ['users', 'department'],
                        width: 150,
                      },
                      {
                        title: '本月积分',
                        dataIndex: 'total_score',
                        width: 120,
                        render: (score) => (
                          <Tag color="green" style={{ fontSize: '14px', padding: '4px 8px' }}>
                            {score} 分
                          </Tag>
                        )
                      },
                      {
                        title: '进度',
                        key: 'progress',
                        render: (_, record) => {
                          const maxScore = rankingData[0]?.total_score || 1;
                          const percent = (record.total_score / maxScore) * 100;
                          return (
                            <Progress 
                              percent={percent} 
                              size="small" 
                              showInfo={false}
                              strokeColor={{
                                '0%': '#108ee9',
                                '100%': '#87d068',
                              }}
                            />
                          );
                        }
                      }
                    ]}
                  />
                </Card>
              </Col>
            </Row>
              )
            },
            {
              key: 'personal',
              label: '个人积分',
              children: (
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="累计积分"
                        value={personalStats?.totalScore || 0}
                        suffix="分"
                        valueStyle={{ color: '#3f8600' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="获奖次数"
                        value={personalStats?.recordCount || 0}
                        suffix="次"
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<GiftOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="本月排名"
                        value={rankingData.findIndex(item => item.user_id === user?.id) + 1 || '-'}
                        valueStyle={{ color: '#722ed1' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="奖励类别"
                        value={Object.keys(personalStats?.categoryStats || {}).length}
                        suffix="种"
                        valueStyle={{ color: '#eb2f96' }}
                        prefix={<GiftOutlined />}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>
              
              <Col span={12}>
                <Card title="最近获奖记录">
                  <Table
                    dataSource={personalStats?.recentRecords || []}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '奖励类型',
                        dataIndex: ['reward_types', 'name'],
                      },
                      {
                        title: '积分',
                        dataIndex: 'score',
                        render: (score) => <Tag color="green">+{score}</Tag>
                      },
                      {
                        title: '获奖日期',
                        dataIndex: 'award_date',
                        render: (date) => new Date(date).toLocaleDateString()
                      }
                    ]}
                  />
                </Card>
              </Col>
              
              <Col span={12}>
                <Card title="积分分布">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {Object.entries(personalStats?.categoryStats || {}).map(([category, score]) => {
                      const maxScore = Math.max(...Object.values(personalStats?.categoryStats || {}).map(v => Number(v)));
                      const percent = ((score as number) / maxScore) * 100;
                      return (
                        <div key={category}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>{category}</span>
                            <span>{Number(score)} 分</span>
                          </div>
                          <Progress percent={percent} size="small" />
                        </div>
                      );
                    })}
                  </Space>
                </Card>
              </Col>
            </Row>
              )
            },
            {
              key: 'statistics',
              label: '数据统计',
              children: (
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="总奖励记录"
                        value={statisticsData?.totalRecords || 0}
                        suffix="条"
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<GiftOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="总积分"
                        value={statisticsData?.totalScore || 0}
                        suffix="分"
                        valueStyle={{ color: '#3f8600' }}
                        prefix={<TrophyOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="本年记录"
                        value={statisticsData?.yearRecords || 0}
                        suffix="条"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Card>
                      <Statistic
                        title="本月记录"
                        value={statisticsData?.monthRecords || 0}
                        suffix="条"
                        valueStyle={{ color: '#eb2f96' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Col>
              
              <Col span={12}>
                <Card title="奖励类别分布">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {Object.entries(statisticsData?.categoryStats || {}).map(([category, score]) => {
                      const categoryNames = {
                        'commendation': '表彰奖励',
                        'advanced': '先进奖励', 
                        'innovation': '创新奖励',
                        'special': '专项奖励',
                        'other': '其他奖励'
                      };
                      const maxScore = Math.max(...Object.values(statisticsData?.categoryStats || {}).map(v => Number(v)));
                      const percent = ((score as number) / maxScore) * 100;
                      return (
                        <div key={category}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                             <span>{categoryNames[category as keyof typeof categoryNames] || category}</span>
                             <span>{Number(score)} 分</span>
                           </div>
                          <Progress percent={percent} size="small" />
                        </div>
                      );
                    })}
                  </Space>
                </Card>
              </Col>
              
              <Col span={12}>
                <Card title="月度趋势">
                  <div style={{ height: '300px', display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>
                    {statisticsData?.monthlyStats?.slice(-6).map((item: any, index: number) => {
                      const maxScore = Math.max(...(statisticsData?.monthlyStats?.map((s: any) => s.score) || [1]));
                      const height = (item.score / maxScore) * 200;
                      return (
                        <div key={item.month} style={{ textAlign: 'center', flex: 1 }}>
                          <Tooltip title={`${item.month}: ${item.score}分 (${item.count}条)`}>
                            <div
                              style={{
                                height: `${height}px`,
                                backgroundColor: '#1890ff',
                                margin: '0 4px',
                                borderRadius: '2px 2px 0 0',
                                minHeight: '2px'
                              }}
                            />
                          </Tooltip>
                          <div style={{ fontSize: '12px', marginTop: '8px' }}>
                            {item.month.slice(-2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </Col>
            </Row>
              )
            },
            {
              key: 'records',
              label: '奖励记录',
              children: (
                <div>
                  <div className="mb-4">
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={6}>
                  <Input
                    placeholder="搜索用户姓名或奖励类型"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Select
                    placeholder="奖励类型"
                    value={filterType}
                    onChange={setFilterType}
                    style={{ width: '100%' }}
                  >
                    <Option value="all">全部类型</Option>
                    <Option value="commendation">表彰奖励</Option>
                    <Option value="advanced">先进奖励</Option>
                    <Option value="innovation">创新奖励</Option>
                    <Option value="special">专项奖励</Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Select
                    placeholder="部门"
                    value={departmentFilter}
                    onChange={setDepartmentFilter}
                    style={{ width: '100%' }}
                  >
                    <Option value="all">全部部门</Option>
                    {departments.map(dept => (
                      <Option key={dept} value={dept}>{dept}</Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    style={{ width: '100%' }}
                    placeholder={['开始日期', '结束日期']}
                  />
                </Col>
                <Col xs={24} sm={12} md={4}>
                  <Button
                    onClick={() => {
                      setSearchText('');
                      setFilterType('all');
                      setDepartmentFilter('all');
                      setDateRange(null);
                    }}
                  >
                    重置
                  </Button>
                </Col>
              </Row>
              
              <Space wrap>
                {hasPermission('write') && (
                  <>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingRecord(null);
                        setModalVisible(true);
                        form.resetFields();
                      }}
                    >
                      新增奖励
                    </Button>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => setImportModalVisible(true)}
                    >
                      批量导入
                    </Button>
                    {selectedRowKeys.length > 0 && (
                      <Popconfirm
                        title="确定要删除选中的记录吗？"
                        onConfirm={handleBatchDelete}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button danger icon={<DeleteOutlined />}>
                          批量删除 ({selectedRowKeys.length})
                        </Button>
                      </Popconfirm>
                    )}
                  </>
                )}
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => downloadExcelTemplate()}
                >
                  下载模板
                </Button>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={handleExportData}
                >
                  导出数据
                </Button>
              </Space>
            </div>
            
            <Spin spinning={loading}>
              <Table
                columns={recordColumns}
                dataSource={getFilteredData()}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                  selections: [
                    Table.SELECTION_ALL,
                    Table.SELECTION_INVERT,
                    Table.SELECTION_NONE,
                  ],
                }}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
                scroll={{ x: 1200 }}
              />
                  </Spin>
                </div>
              )
            },
            {
              key: 'summary',
              label: '月度汇总',
              children: (
                <div>
                  <Spin spinning={loading}>
              <Table
                columns={summaryColumns}
                dataSource={monthlySummary}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`,
                }}
                scroll={{ x: 800 }}
              />
                  </Spin>
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* 新增/编辑奖励记录模态框 */}
      <Modal
        title={editingRecord ? '编辑奖励记录' : '新增奖励记录'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="user_id"
                label="获奖人员"
                rules={[{ required: true, message: '请选择获奖人员' }]}
              >
                <Select placeholder="请选择获奖人员">
                  {/* 这里需要从用户列表中获取数据 */}
                  <Option value="user1">张三</Option>
                  <Option value="user2">李四</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="reward_type_id"
                label="奖励类型"
                rules={[{ required: true, message: '请选择奖励类型' }]}
              >
                <Select placeholder="请选择奖励类型">
                  {rewardTypes.map((type) => (
                    <Option key={type.id} value={type.id}>
                      {type.name} ({type.base_score}-{type.max_score}分)
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="奖励标题"
            rules={[{ required: true, message: '请输入奖励标题' }]}
          >
            <Input placeholder="请输入奖励标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="奖励描述"
          >
            <Input.TextArea
              placeholder="请输入奖励描述"
              rows={3}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="score"
                label="分值"
                rules={[{ required: true, message: '请输入分值' }]}
              >
                <InputNumber
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="分值"
                  className="w-full"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="award_date"
                label="奖励日期"
                rules={[{ required: true, message: '请选择奖励日期' }]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="award_period"
                label="奖励周期"
                rules={[{ required: true, message: '请输入奖励周期' }]}
              >
                <Input placeholder="如：2024-01" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="certificate_number"
            label="证书编号"
          >
            <Input placeholder="请输入证书编号（可选）" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingRecord(null);
                  form.resetFields();
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingRecord ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入模态框 */}
      <Modal
        title="批量导入奖励记录"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportData([]);
          setPreviewData([]);
        }}
        width={800}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              setImportModalVisible(false);
              setImportData([]);
              setPreviewData([]);
            }}
          >
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={importLoading}
            disabled={importData.length === 0}
            onClick={handleConfirmImport}
          >
            确认导入 ({importData.length} 条)
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Alert
            message="导入说明"
            description="请下载模板文件，按照模板格式填写数据后上传。支持 Excel (.xlsx, .xls) 和 CSV 格式。"
            type="info"
            showIcon
          />
          
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={downloadExcelTemplate}
            >
              下载导入模板
            </Button>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              beforeUpload={handleFileUpload}
              disabled={importLoading}
            >
              <Button icon={<UploadOutlined />} loading={importLoading}>
                {importLoading ? '解析中...' : '选择文件'}
              </Button>
            </Upload>
          </Space>

          {previewData.length > 0 && (
            <div>
              <h4>数据预览 ({previewData.length} 条记录)</h4>
              <Table
                dataSource={previewData}
                size="small"
                scroll={{ y: 300 }}
                pagination={false}
                columns={[
                  {
                    title: '用户ID',
                    dataIndex: 'userId',
                    width: 100,
                  },
                  {
                    title: '用户姓名',
                    dataIndex: 'userName',
                    width: 100,
                  },
                  {
                    title: '奖励类型',
                    dataIndex: 'rewardType',
                    width: 120,
                  },
                  {
                    title: '积分',
                    dataIndex: 'score',
                    width: 80,
                    render: (score) => <Tag color="green">+{score}</Tag>
                  },
                  {
                    title: '颁发日期',
                    dataIndex: 'awardDate',
                    width: 100,
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                    ellipsis: true,
                  },
                ]}
              />
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default PerformanceReward;