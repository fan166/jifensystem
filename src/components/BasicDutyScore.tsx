import React, { useState, useEffect } from 'react';
import { Card, Tabs, message, Button, Upload, Modal, Space, Table, Tag } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, BookOutlined, ExclamationCircleOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import AttendanceScore from './AttendanceScore';
import LearningScore from './LearningScore';
import DisciplineScore from './DisciplineScore';
import BasicDutyStats from './BasicDutyStats';
import { userAPI, scoreAPI, scoreTypeAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../lib/supabase';

// const { TabPane } = Tabs; // 已废弃，使用items属性

interface BasicDutyScoreProps {
  readonly?: boolean;
}

const BasicDutyScore: React.FC<BasicDutyScoreProps> = ({ readonly = false }) => {
  const { user, hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('stats');
  const [addTrigger, setAddTrigger] = useState(0);

  // 导入相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [basicDutyTypes, setBasicDutyTypes] = useState<any[]>([]);

  // 检查用户权限
  const canEdit = !readonly && hasPermission('write');
  const isEmployee = user?.role === 'employee';

  useEffect(() => {
    // 预载入导入所需的用户与积分类型
    if (canEdit) {
      Promise.all([
        userAPI.getUsers(),
        scoreTypeAPI.getScoreTypesByCategory('basic_duty')
      ]).then(([users, types]) => {
        setAllUsers(users);
        setBasicDutyTypes(types);
      }).catch(err => {
        console.error('预载入基础数据失败:', err);
      });
    }
  }, [canEdit]);

  // 模板下载
  const downloadTemplate = () => {
    if (!canEdit) return;
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

  // 文件上传处理
  const handleFileUpload = (file: File) => {
    if (!canEdit) return false;
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
  const processImportData = (rawData: any[][]) => {
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
      return rowData;
    });
  };

  // 验证行数据
  const validateRowData = (rowData: any) => {
    const errors: string[] = [];
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
    if (!canEdit) return;
    const validData = importData.filter((item: any) => item.valid?.isValid);
    if (validData.length === 0) {
      message.error('没有有效的数据可以导入');
      return;
    }
    setImportLoading(true);
    let successCount = 0;
    let failedCount = 0;
    const failedItems: string[] = [];
    const period = new Date().toISOString().slice(0, 7);
    try {
      for (const item of validData) {
        try {
          const importUserName = String(item['姓名']).trim();
          const targetUser = allUsers.find(u => String(u.name).trim() === importUserName);
          if (!targetUser) throw new Error(`用户 ${importUserName} 不存在`);

          const scorePromises: Promise<any>[] = [];
          // 类型查找
          const attendanceType = basicDutyTypes.find((st: any) => st.name.includes('考勤') || st.name.includes('出勤'));
          const learningType = basicDutyTypes.find((st: any) => st.name.includes('学习') || st.name.includes('培训'));
          const disciplineType = basicDutyTypes.find((st: any) => st.name.includes('纪律') || st.name.includes('规范'));

          const attendanceScore = Number(item['考勤管理(0-5分)']);
          if (attendanceType && attendanceScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: attendanceType.id,
              score: attendanceScore,
              reason: `考勤管理积分：${attendanceScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
              recorder_id: user?.id || '',
              period
            }));
          }

          const learningScore = Number(item['基础学习(0-5分)']);
          if (learningType && learningScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: learningType.id,
              score: learningScore,
              reason: `基础学习积分：${learningScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
              recorder_id: user?.id || '',
              period
            }));
          }

          const disciplineScore = Number(item['工作纪律(0-10分)']);
          if (disciplineType && disciplineScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: disciplineType.id,
              score: disciplineScore,
              reason: `工作纪律积分：${disciplineScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
              recorder_id: user?.id || '',
              period
            }));
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
      }
    } catch (error) {
      console.error('批量导入过程中发生错误:', error);
      message.error('导入过程中发生错误');
    } finally {
      setImportLoading(false);
    }
  };

  

  return (
    <Card 
      extra={canEdit ? (
        <Space>
          <Button type="primary" onClick={() => { setActiveTab('attendance'); setAddTrigger(v => v + 1); }}>添加积分记录</Button>
          <Upload accept=".xlsx,.xls,.csv" beforeUpload={handleFileUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>批量导入</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
        </Space>
      ) : null}
    >
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'stats',
            label: <span><BarChartOutlined />积分统计</span>,
            children: <BasicDutyStats currentUserId={isEmployee ? user?.id : undefined} />
          },
          {
            key: 'attendance',
            label: <span><ClockCircleOutlined />考勤管理</span>,
            children: <AttendanceScore readonly={!canEdit} currentUserId={isEmployee ? user?.id : undefined} addTrigger={addTrigger} />
          },
          {
            key: 'learning',
        label: <span><BookOutlined />基础学习</span>,
            children: <LearningScore readonly={!canEdit} />
          },
          {
            key: 'discipline',
        label: <span><ExclamationCircleOutlined />工作纪律</span>,
            children: <DisciplineScore readonly={!canEdit} currentUserId={isEmployee ? user?.id : undefined} />
          }
        ]}
      />

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
            disabled={!canEdit || importData.filter((item: any) => item.valid?.isValid).length === 0}
          >
            导入数据 ({importData.filter((item: any) => item.valid?.isValid).length}条)
          </Button>
        ]}
      >
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">
            共 {importData.length} 条数据，其中 {importData.filter((item: any) => item.valid?.isValid).length} 条有效，
            {importData.filter((item: any) => !item.valid?.isValid).length} 条无效
          </div>
        </div>
        <Table
          dataSource={importData}
          rowKey="key"
          pagination={false}
          scroll={{ x: 1000, y: 400 }}
          size="small"
          columns={[
            { title: '姓名', dataIndex: '姓名', key: 'name', width: 80, fixed: 'left' },
            { title: '部门', dataIndex: '部门', key: 'department', width: 100 },
            { title: '考勤管理', dataIndex: '考勤管理(0-5分)', key: 'attendance', width: 90, render: (v: any) => (<Tag color={Number(v) > 0 ? 'green' : 'default'}>{v}分</Tag>) },
            { title: '基础学习', dataIndex: '基础学习(0-5分)', key: 'learning', width: 90, render: (v: any) => (<Tag color={Number(v) > 0 ? 'blue' : 'default'}>{v}分</Tag>) },
            { title: '工作纪律', dataIndex: '工作纪律(0-10分)', key: 'discipline', width: 90, render: (v: any) => (<Tag color={Number(v) > 0 ? 'orange' : 'default'}>{v}分</Tag>) },
            { title: '总分', dataIndex: '总分', key: 'total', width: 70, render: (_: any, record: any) => (<Tag color="green">{record.valid?.calculatedTotal || 0}分</Tag>) },
            { title: '备注', dataIndex: '备注', key: 'remark', width: 120, ellipsis: true },
            { title: '状态', key: 'status', width: 80, fixed: 'right', render: (_: any, record: any) => (record.valid?.isValid ? (<Tag color="green">有效</Tag>) : (<Tag color="red" title={(record.valid?.errors || []).join(', ')}>无效</Tag>)) }
          ]}
        />
      </Modal>
    </Card>
  );
};

export default BasicDutyScore;