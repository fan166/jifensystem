import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tag, Spin, Upload, Divider, Row, Col, Statistic, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, FileExcelOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import { scoreAPI, scoreTypeAPI, userAPI, departmentAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { Score, ScoreType, User, Department } from '../lib/supabase';

const { Option } = Select;
const { TextArea } = Input;

interface BasicDutyScoreRecord extends Score {
  user?: { name: string; email: string; department?: { name: string } };
  score_type?: { name: string; category: string };
  recorder?: { name: string };
}

interface ImportDataItem {
  key: number;
  '姓名': string;
  '部门': string;
  '考勤管理(0-5分)': number;
  '基础学习(0-5分)': number;
  '工作纪律(0-10分)': number;
  '总分': number;
  '备注'?: string;
  valid: {
    isValid: boolean;
    errors: string[];
    calculatedTotal: number;
  };
}

interface ScoreStats {
  totalUsers: number;
  totalScores: number;
  averageScore: number;
  attendanceAvg: number;
  learningAvg: number;
  disciplineAvg: number;
}

const BasicDutyScore: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BasicDutyScoreRecord | null>(null);
  const [form] = Form.useForm();
  const [scoreRecords, setScoreRecords] = useState<BasicDutyScoreRecord[]>([]);
  const [scoreTypes, setScoreTypes] = useState<ScoreType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [importData, setImportData] = useState<ImportDataItem[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(new Date().toISOString().slice(0, 7));
  const [stats, setStats] = useState<ScoreStats>({
    totalUsers: 0,
    totalScores: 0,
    averageScore: 0,
    attendanceAvg: 0,
    learningAvg: 0,
    disciplineAvg: 0
  });
  
  const { user: currentUser, hasPermission } = useAuthStore();

  // 加载数据
  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresData, scoreTypesData, usersData, departmentsData] = await Promise.all([
        scoreAPI.getScores({ category: 'basic_duty', period: selectedPeriod }),
        scoreTypeAPI.getScoreTypesByCategory('basic_duty'),
        userAPI.getUsers(),
        departmentAPI.getDepartments()
      ]);
      
      setScoreRecords(scoresData);
      setScoreTypes(scoreTypesData);
      setUsers(usersData);
      setDepartments(departmentsData);
      
      // 计算统计数据
      calculateStats(scoresData, usersData);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 计算统计数据
  const calculateStats = (scores: BasicDutyScoreRecord[], allUsers: User[]) => {
    const userScoreMap = new Map<string, { attendance: number; learning: number; discipline: number; total: number }>();
    
    scores.forEach(score => {
      const userId = score.user_id;
      const scoreValue = score.score || 0;
      const scoreTypeName = score.score_type?.name || '';
      
      if (!userScoreMap.has(userId)) {
        userScoreMap.set(userId, { attendance: 0, learning: 0, discipline: 0, total: 0 });
      }
      
      const userScore = userScoreMap.get(userId)!;
      userScore.total += scoreValue;
      
      if (scoreTypeName.includes('考勤') || scoreTypeName.includes('出勤')) {
        userScore.attendance += scoreValue;
      } else if (scoreTypeName.includes('学习') || scoreTypeName.includes('培训')) {
        userScore.learning += scoreValue;
      } else if (scoreTypeName.includes('纪律') || scoreTypeName.includes('规范')) {
        userScore.discipline += scoreValue;
      }
    });
    
    const userCount = userScoreMap.size;
    const totalScore = Array.from(userScoreMap.values()).reduce((sum, user) => sum + user.total, 0);
    const attendanceTotal = Array.from(userScoreMap.values()).reduce((sum, user) => sum + user.attendance, 0);
    const learningTotal = Array.from(userScoreMap.values()).reduce((sum, user) => sum + user.learning, 0);
    const disciplineTotal = Array.from(userScoreMap.values()).reduce((sum, user) => sum + user.discipline, 0);
    
    setStats({
      totalUsers: userCount,
      totalScores: scores.length,
      averageScore: userCount > 0 ? Number((totalScore / userCount).toFixed(1)) : 0,
      attendanceAvg: userCount > 0 ? Number((attendanceTotal / userCount).toFixed(1)) : 0,
      learningAvg: userCount > 0 ? Number((learningTotal / userCount).toFixed(1)) : 0,
      disciplineAvg: userCount > 0 ? Number((disciplineTotal / userCount).toFixed(1)) : 0
    });
  };

  // 生成期间选项
  const generatePeriodOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const period = date.toISOString().slice(0, 7);
      const label = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
      options.push({ value: period, label });
    }
    return options;
  };

  const baseColumns: ColumnsType<BasicDutyScoreRecord> = [
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
      title: '积分类型',
      dataIndex: ['score_type', 'name'],
      key: 'scoreType',
      width: 120,
      render: (text) => {
        let color = 'blue';
        if (text?.includes('考勤')) color = 'green';
        else if (text?.includes('学习')) color = 'orange';
        else if (text?.includes('纪律')) color = 'red';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: '积分值',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (value) => (
        <Tag color={Number(value) > 0 ? 'green' : 'red'}>
          {Number(value) > 0 ? '+' : ''}{value}
        </Tag>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
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
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        hasPermission('write') ? (
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
        ) : null
      )
    }
  ];

  const columns: ColumnsType<BasicDutyScoreRecord> = hasPermission('write')
    ? baseColumns
    : baseColumns.filter(col => col.key !== 'action');

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: BasicDutyScoreRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      userId: record.user_id,
      scoreTypeId: record.score_type_id,
      score: record.score,
      reason: record.reason
    });
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条基本职责积分记录吗？',
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
        score: values.score,
        reason: values.reason,
        recorder_id: currentUser?.id,
        period: selectedPeriod
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

  // 文件上传处理
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        const processedData = processImportData(jsonData);
        setImportData(processedData);
        setImportModalVisible(true);
      } catch (error) {
        console.error('文件解析失败:', error);
        message.error('文件解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 处理导入数据
  const processImportData = (rawData: any[][]): ImportDataItem[] => {
    if (rawData.length < 2) {
      message.error('文件数据不足，至少需要包含表头和一行数据');
      return [];
    }

    let dataStartIndex = 0;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row && row[0] === '姓名') {
        dataStartIndex = i;
        break;
      }
    }

    if (dataStartIndex === 0 && rawData[0][0] !== '姓名') {
      message.error('未找到有效的表头，请检查文件格式');
      return [];
    }

    const headers = rawData[dataStartIndex];
    const requiredHeaders = ['姓名', '部门', '考勤管理(0-5分)', '基础学习(0-5分)', '工作纪律(0-10分)'];
    const isValidHeader = requiredHeaders.every(header => headers.includes(header));
    
    if (!isValidHeader) {
      message.error(`表头格式不正确，应包含：${requiredHeaders.join('、')}`);
      return [];
    }

    const dataRows = rawData.slice(dataStartIndex + 1).filter(row => row && row.some(cell => cell !== undefined && cell !== ''));
    return dataRows.map((row, index) => {
      const rowData: any = { key: index };
      headers.forEach((header, headerIndex) => {
        rowData[header] = row[headerIndex];
      });
      rowData.valid = validateRowData(rowData);
      return rowData as ImportDataItem;
    });
  };

  // 验证行数据
  const validateRowData = (rowData: any) => {
    const errors = [];
    
    if (!rowData['姓名']) errors.push('姓名不能为空');
    if (!rowData['部门']) errors.push('部门不能为空');
    
    const attendanceScore = Number(rowData['考勤管理(0-5分)']);
    if (isNaN(attendanceScore) || attendanceScore < 0 || attendanceScore > 5) {
      errors.push('考勤管理得分必须为0-5之间的数字');
    }
    
    const learningScore = Number(rowData['基础学习(0-5分)']);
    if (isNaN(learningScore) || learningScore < 0 || learningScore > 5) {
      errors.push('基础学习得分必须为0-5之间的数字');
    }
    
    const disciplineScore = Number(rowData['工作纪律(0-10分)']);
    if (isNaN(disciplineScore) || disciplineScore < 0 || disciplineScore > 10) {
      errors.push('工作纪律得分必须为0-10之间的数字');
    }
    
    const calculatedTotal = attendanceScore + learningScore + disciplineScore;
    const providedTotal = Number(rowData['总分']);
    if (!isNaN(providedTotal) && Math.abs(providedTotal - calculatedTotal) > 0.1) {
      errors.push(`总分不匹配，应为${calculatedTotal}分`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      calculatedTotal
    };
  };

  // 批量导入数据
  const handleBatchImport = async () => {
    const validData = importData.filter(item => item.valid.isValid);
    if (validData.length === 0) {
      message.error('没有有效的数据可以导入');
      return;
    }

    setImportLoading(true);
    let successCount = 0;
    let failedCount = 0;
    const failedItems: string[] = [];

    try {
      for (const item of validData) {
        try {
          const importUserName = String(item['姓名']).trim();
          const user = users.find(u => String(u.name).trim() === importUserName);
          
          if (!user) {
            throw new Error(`用户 ${importUserName} 不存在`);
          }

          const scorePromises = [];

          // 创建考勤管理积分记录
          const attendanceScore = Number(item['考勤管理(0-5分)']);
          if (attendanceScore > 0) {
            const attendanceType = scoreTypes.find(st => st.name.includes('考勤') || st.name.includes('出勤'));
            if (attendanceType) {
              scorePromises.push(scoreAPI.createScore({
                user_id: user.id,
                score_type_id: attendanceType.id,
                score: attendanceScore,
                reason: `考勤管理积分：${attendanceScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
                recorder_id: currentUser?.id || '',
                period: selectedPeriod
              }));
            }
          }

          // 创建基础学习积分记录
          const learningScore = Number(item['基础学习(0-5分)']);
          if (learningScore > 0) {
            const learningType = scoreTypes.find(st => st.name.includes('学习') || st.name.includes('培训'));
            if (learningType) {
              scorePromises.push(scoreAPI.createScore({
                user_id: user.id,
                score_type_id: learningType.id,
                score: learningScore,
                reason: `基础学习积分：${learningScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
                recorder_id: currentUser?.id || '',
                period: selectedPeriod
              }));
            }
          }

          // 创建工作纪律积分记录
          const disciplineScore = Number(item['工作纪律(0-10分)']);
          if (disciplineScore > 0) {
            const disciplineType = scoreTypes.find(st => st.name.includes('纪律') || st.name.includes('规范'));
            if (disciplineType) {
              scorePromises.push(scoreAPI.createScore({
                user_id: user.id,
                score_type_id: disciplineType.id,
                score: disciplineScore,
                reason: `工作纪律积分：${disciplineScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
                recorder_id: currentUser?.id || '',
                period: selectedPeriod
              }));
            }
          }

          if (scorePromises.length > 0) {
            await Promise.all(scorePromises);
            successCount += scorePromises.length;
          }
        } catch (itemError) {
          failedCount++;
          const errorMessage = itemError instanceof Error ? itemError.message : String(itemError);
          failedItems.push(`${item['姓名']}: ${errorMessage}`);
        }
      }
      
      if (successCount > 0 && failedCount === 0) {
        message.success(`成功导入 ${successCount} 条积分记录`);
      } else if (successCount > 0 && failedCount > 0) {
        message.warning(`导入完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
      } else {
        message.error('导入失败');
      }
      
      if (successCount > 0) {
        setImportModalVisible(false);
        setImportData([]);
        loadData();
      }
    } catch (error) {
      console.error('批量导入过程中发生错误:', error);
      message.error('导入过程中发生错误');
    } finally {
      setImportLoading(false);
    }
  };

  // 下载模板
  const downloadTemplate = () => {
    const templateData = [
      ['基本职责积分导入模板说明：'],
      ['1. 考勤管理：评分范围0-5分，主要考核出勤情况、请假制度执行等'],
      ['2. 基础学习：评分范围0-5分，主要考核学习态度、培训参与度等'],
      ['3. 工作纪律：评分范围0-10分，主要考核工作规范、制度执行等'],
      ['4. 总分：各项得分之和，系统会自动计算'],
      ['5. 请按照模板格式填写，确保数据准确性'],
      [''],
      ['姓名', '部门', '考勤管理(0-5分)', '基础学习(0-5分)', '工作纪律(0-10分)', '总分', '备注'],
      ['张三', '技术部', '5', '4', '8', '17', '表现良好'],
      ['李四', '市场部', '4', '5', '9', '18', '学习积极'],
      ['王五', '财务部', '5', '3', '7', '15', '需加强学习']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '基本职责积分模板');
    XLSX.writeFile(wb, '基本职责积分导入模板.xlsx');
    
    message.success('模板下载成功');
  };

  return (
    <div className="p-6">
      {/* 统计卡片 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="参与人数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="积分记录数"
              value={stats.totalScores}
              prefix={<FileExcelOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均总分"
              value={stats.averageScore}
              precision={1}
              valueStyle={{ color: '#722ed1' }}
              suffix="分"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">考勤管理分</span>
                <span className="font-medium">{stats.attendanceAvg}分</span>
              </div>
              <Progress percent={(stats.attendanceAvg / 5) * 100} size="small" strokeColor="#52c41a" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">基础学习分</span>
                <span className="font-medium">{stats.learningAvg}分</span>
              </div>
              <Progress percent={(stats.learningAvg / 5) * 100} size="small" strokeColor="#1890ff" />
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">工作纪律分</span>
                <span className="font-medium">{stats.disciplineAvg}分</span>
              </div>
              <Progress percent={(stats.disciplineAvg / 10) * 100} size="small" strokeColor="#fa8c16" />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 主要内容 */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <Space>
            {hasPermission('write') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                添加积分记录
              </Button>
            )}
            <Upload
              accept=".xlsx,.xls,.csv"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              disabled={!hasPermission('write')}
            >
              <Button icon={<UploadOutlined />} disabled={!hasPermission('write')}>
                批量导入
              </Button>
            </Upload>
            {hasPermission('write') && (
              <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                下载模板
              </Button>
            )}
          </Space>
          <Space>
            <span>考核期间：</span>
            <Select
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              style={{ width: 150 }}
              suffixIcon={<CalendarOutlined />}
            >
              {generatePeriodOptions().map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Space>
        </div>
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={scoreRecords}
            rowKey="id"
            pagination={{ 
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            scroll={{ x: 1200 }}
          />
        </Spin>
      </Card>

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑基本职责积分记录' : '添加基本职责积分记录'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
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

          <Form.Item
            name="scoreTypeId"
            label="积分类型"
            rules={[{ required: true, message: '请选择积分类型' }]}
          >
            <Select placeholder="请选择积分类型">
              {scoreTypes.map(type => (
                <Option key={type.id} value={type.id}>{type.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="score"
            label="积分值"
            rules={[{ required: true, message: '请输入积分值' }]}
          >
            <InputNumber
              placeholder="请输入积分值"
              step={0.1}
              precision={1}
              className="w-full"
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="原因说明"
            rules={[{ required: true, message: '请输入原因说明' }]}
          >
            <TextArea
              placeholder="请输入原因说明"
              rows={3}
            />
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

      {/* 数据导入预览模态框 */}
      <Modal
        title="基本职责积分数据导入预览"
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportData([]);
        }}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => {
            setImportModalVisible(false);
            setImportData([]);
          }}>
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importLoading}
            onClick={handleBatchImport}
            disabled={!hasPermission('write') || importData.filter(item => item.valid.isValid).length === 0}
          >
            导入数据 ({importData.filter(item => item.valid.isValid).length}条)
          </Button>
        ]}
      >
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">
            共 {importData.length} 条数据，其中 {importData.filter(item => item.valid.isValid).length} 条有效，
            {importData.filter(item => !item.valid.isValid).length} 条无效
          </div>
        </div>
        
        <Table
          dataSource={importData}
          rowKey="key"
          pagination={false}
          scroll={{ x: 1000, y: 400 }}
          size="small"
          columns={[
            {
              title: '姓名',
              dataIndex: '姓名',
              key: 'name',
              width: 80,
              fixed: 'left'
            },
            {
              title: '部门',
              dataIndex: '部门',
              key: 'department',
              width: 100
            },
            {
              title: '考勤管理',
              dataIndex: '考勤管理(0-5分)',
              key: 'attendance',
              width: 90,
              render: (value) => (
                <Tag color={Number(value) > 0 ? 'green' : 'default'}>
                  {value}分
                </Tag>
              )
            },
            {
              title: '基础学习',
              dataIndex: '基础学习(0-5分)',
              key: 'learning',
              width: 90,
              render: (value) => (
                <Tag color={Number(value) > 0 ? 'blue' : 'default'}>
                  {value}分
                </Tag>
              )
            },
            {
              title: '工作纪律',
              dataIndex: '工作纪律(0-10分)',
              key: 'discipline',
              width: 90,
              render: (value) => (
                <Tag color={Number(value) > 0 ? 'orange' : 'default'}>
                  {value}分
                </Tag>
              )
            },
            {
              title: '总分',
              dataIndex: '总分',
              key: 'total',
              width: 70,
              render: (value, record) => {
                const calculated = record.valid.calculatedTotal || 0;
                return (
                  <Tag color="green">
                    {calculated}分
                  </Tag>
                );
              }
            },
            {
              title: '备注',
              dataIndex: '备注',
              key: 'remark',
              width: 120,
              ellipsis: true
            },
            {
              title: '状态',
              key: 'status',
              width: 80,
              fixed: 'right',
              render: (_, record) => (
                <div>
                  {record.valid.isValid ? (
                    <Tag color="green">有效</Tag>
                  ) : (
                    <Tag color="red" title={record.valid.errors.join(', ')}>无效</Tag>
                  )}
                </div>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
};

export default BasicDutyScore;