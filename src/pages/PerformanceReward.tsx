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
  Space,
  Tag,
  Typography,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileExcelOutlined,
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
const { Title, Text } = Typography;

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
    department?: { name: string };
  };
  reward_type?: RewardType;
  issuer?: {
    name: string;
  };
}

const PerformanceReward: React.FC = () => {
  const { user, hasPermission } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [rewardTypes, setRewardTypes] = useState<RewardType[]>([]);
  const [rewardRecords, setRewardRecords] = useState<RewardRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RewardRecord | null>(null);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importData, setImportData] = useState<any[]>([]);

  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<RewardImportData[]>([]);

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

  // 获取奖励记录 - 增强错误处理和重试机制
  const fetchRewardRecords = async (retryCount = 0) => {
    try {
      setLoading(true);
      const { data: baseRecords, error: baseError } = await supabase
        .from('reward_score_records')
        .select('*')
        .order('award_date', { ascending: false });

      if (baseError) throw baseError;

      if (!baseRecords || baseRecords.length === 0) {
        setRewardRecords([]);
        return;
      }

      const userIds = Array.from(new Set(baseRecords.map(r => r.user_id).filter(Boolean)));
      const issuerIds = Array.from(new Set(baseRecords.map(r => r.issuer_id).filter(Boolean)));

      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, department_id')
        .in('id', Array.from(new Set([...userIds, ...issuerIds])));

      const deptIds = Array.from(new Set((usersData || []).map(u => u.department_id).filter(Boolean)));

      const { data: departmentsData } = deptIds.length
        ? await supabase.from('departments').select('id, name').in('id', deptIds)
        : { data: [] } as any;

      const deptMap = new Map((departmentsData || []).map((d: any) => [d.id, d.name]));
      const userMap = new Map((usersData || []).map((u: any) => [u.id, { name: u.name, department: u.department_id ? { name: deptMap.get(u.department_id) } : undefined }]));

      const typeIds = Array.from(new Set(baseRecords.map(r => r.reward_type_id).filter(Boolean)));
      const { data: typesData } = await supabase
        .from('reward_types')
        .select('*')
        .in('id', typeIds);
      const typeMap = new Map((typesData || []).map((t: any) => [t.id, t]));

      const enriched = baseRecords.map((r: any) => ({
        ...r,
        user: userMap.get(r.user_id),
        issuer: userMap.get(r.issuer_id) ? { name: userMap.get(r.issuer_id).name } : undefined,
        reward_type: typeMap.get(r.reward_type_id),
      }));

      setRewardRecords(enriched);
    } catch (error: any) {
      console.error('获取奖励记录失败:', error);
      
      // 详细的错误处理
      let errorMessage = '获取奖励记录失败';
      if (error.code === 'PGRST116') {
        errorMessage = '权限不足，无法访问奖励记录数据';
      } else if (error.code === 'PGRST301') {
        errorMessage = '数据表不存在或结构错误';
      } else if (error.code === '42P01') {
        errorMessage = '数据表不存在';
      } else if (error.code === '42501') {
        errorMessage = '权限被拒绝，请联系管理员';
      }
      
      message.error(errorMessage);
      
      // 重试机制
      if (retryCount < 2 && error.code !== '42501' && error.code !== 'PGRST116') {
        console.log(`第 ${retryCount + 1} 次重试...`);
        setTimeout(() => fetchRewardRecords(retryCount + 1), 1000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('PerformanceReward 组件挂载，开始加载数据...');
    fetchRewardTypes();
    fetchRewardRecords();
  }, [user?.id]);

  // 处理表单提交
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const formData = {
        ...values,
        user_id: values.user_id || user?.id,
        issuer_id: user?.id,
        award_date: values.award_date.format('YYYY-MM-DD'),
        award_period: values.award_period || dayjs().format('YYYY-MM'),
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('reward_score_records')
          .update(formData)
          .eq('id', editingRecord.id);

        if (error) throw error;
        message.success('更新成功');
      } else {
        const { error } = await supabase
          .from('reward_score_records')
          .insert(formData);

        if (error) throw error;
        message.success('添加成功');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      
      // 重新获取数据
      fetchRewardRecords();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理删除
  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('reward_score_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      message.success('删除成功');
      
      // 重新获取数据
      fetchRewardRecords();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 处理编辑
  const handleEdit = (record: RewardRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      award_date: dayjs(record.award_date),
    });
    setModalVisible(true);
  };

  // 处理导入
  const handleImport = async () => {
    try {
      setImportLoading(true);
      
      // 这里应该处理导入逻辑
      console.log('处理批量导入...');
      
      message.success('批量导入功能开发中');
      setImportModalVisible(false);
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    } finally {
      setImportLoading(false);
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
      dataIndex: ['user', 'department', 'name'],
      key: 'department',
      width: 120,
    },
    {
      title: '奖励项目',
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
  ];

  // 主要内容 - 直接显示奖励记录表格

  return (
    <div className="p-6">
      {/* 主要内容区域 */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Title level={4} style={{ margin: 0 }}>奖励记录</Title>
          <div className="flex gap-2">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              新增奖励
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              批量导入
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadTemplate}
            >
              下载模板
            </Button>
          </div>
        </div>
        
        <Table
          columns={recordColumns}
          dataSource={rewardRecords}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑奖励记录' : '新增奖励记录'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingRecord(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            award_date: dayjs(),
            award_period: dayjs().format('YYYY-MM'),
          }}
        >
          <Form.Item
            name="user_id"
            label="获奖人员"
            rules={[{ required: true, message: '请选择获奖人员' }]}
          >
            <Select
              placeholder="选择获奖人员"
              showSearch
              filterOption={(input, option) =>
                option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {/* 这里应该加载用户列表 */}
              <Option value="user1">张三</Option>
              <Option value="user2">李四</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="reward_type_id"
            label="奖励类型"
            rules={[{ required: true, message: '请选择奖励类型' }]}
          >
            <Select placeholder="选择奖励类型">
              {rewardTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} ({type.category})
                </Option>
              ))}
            </Select>
          </Form.Item>

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
            rules={[{ required: true, message: '请输入奖励描述' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="请输入奖励描述"
            />
          </Form.Item>

          <Form.Item
            name="score"
            label="分值"
            rules={[
              { required: true, message: '请输入分值' },
              { type: 'number', min: 0, message: '分值必须大于等于0' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入分值"
              min={0}
              step={0.1}
              precision={1}
            />
          </Form.Item>

          <Form.Item
            name="award_date"
            label="奖励日期"
            rules={[{ required: true, message: '请选择奖励日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="certificate_number"
            label="证书编号"
          >
            <Input placeholder="请输入证书编号（可选）" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
                setEditingRecord(null);
              }}>
                取消
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
          setFileList([]);
          setImportData([]);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setImportModalVisible(false);
            setFileList([]);
            setImportData([]);
          }}>
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importLoading}
            onClick={handleImport}
            disabled={importData.length === 0}
          >
            导入
          </Button>,
        ]}
        width={800}
      >
        <div className="mb-4">
          <Text type="secondary">
            请按照模板格式准备数据，支持 Excel 文件（.xlsx, .xls）
          </Text>
        </div>
        
        <Upload
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          beforeUpload={(file) => {
            // 这里应该处理文件解析
            console.log('上传文件:', file);
            return false;
          }}
          accept=".xlsx,.xls"
        >
          <Button icon={<UploadOutlined />}>
            选择文件
          </Button>
        </Upload>

        {previewData.length > 0 && (
          <div className="mt-4">
            <Title level={5}>数据预览</Title>
            <Table
              columns={[
                { title: '用户ID', dataIndex: 'userId', key: 'userId' },
                { title: '奖励类型', dataIndex: 'rewardType', key: 'rewardType' },
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '分值', dataIndex: 'score', key: 'score' },
              ]}
              dataSource={previewData}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PerformanceReward;
