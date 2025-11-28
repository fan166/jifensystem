import React, { useState, useEffect } from 'react';
import { Card, Tabs, message, Button, Upload, Modal, Space, Table, Tag } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, BookOutlined, ExclamationCircleOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import AttendanceScore from './AttendanceScore';
import LearningScore from './LearningScore';
import DisciplineScore from './DisciplineScore';
import BasicDutyStats from './BasicDutyStats';
import { userAPI, scoreAPI, scoreTypeAPI } from '../services/api';
import { supabase } from '../lib/supabase';
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
      ]).then(async ([users, types]) => {
        setAllUsers(users);
        if (!types || types.length === 0) {
          await ensureBasicDutyTypes();
          const refreshed = await scoreTypeAPI.getScoreTypesByCategory('basic_duty');
          setBasicDutyTypes(refreshed);
        } else {
          setBasicDutyTypes(types);
        }
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
      ['1. 采用扣分规则：满分 20 分（考勤5 + 学习5 + 纪律10）'],
      ['2. 计算公式：基本职责积分 = 20 − 考勤扣分 − 学习扣分 − 纪律扣分'],
      ['3. 扣分范围：考勤 0-5，学习 0-5，纪律 0-10'],
      ['4. 总分列已设置公式，请按列填写扣分数据'],
      ['5. 请按照模板格式填写，确保数据准确性'],
      [''],
      ['姓名', '部门', '考勤管理(0-5分)', '基础学习(0-5分)', '工作纪律(0-10分)', '总分', '备注'],
      ['张三', '技术部', '1', '1', '2', '', '扣分较少'],
      ['李四', '市场部', '0', '2', '3', '', '学习需加强'],
      ['王五', '财务部', '2', '2', '4', '', '纪律需提升']
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['F9'] = { t: 'n', f: '20 - C9 - D9 - E9' } as any;
    ws['F10'] = { t: 'n', f: '20 - C10 - D10 - E10' } as any;
    ws['F11'] = { t: 'n', f: '20 - C11 - D11 - E11' } as any;
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
      dataStartIndex = 0;
    }
    const headers = (rawData[dataStartIndex] || []).map(h => String(h || '').trim());
    const matchIndex = (candidates: string[]) => {
      const norm = (s: string) => s.replace(/\s+/g, '').replace(/[()（）]/g, '');
      for (let i = 0; i < headers.length; i++) {
        const h = norm(headers[i]);
        for (const c of candidates) {
          const cn = norm(c);
          if (h === cn || h.includes(cn)) return i;
        }
      }
      return -1;
    };
    const idxName = matchIndex(['姓名','名字']);
    const idxDept = matchIndex(['部门','所在部门']);
    const idxAttend = matchIndex(['考勤扣分(0-5分)','考勤管理扣分(0-5分)','考勤管理(0-5分)','考勤管理','考勤','出勤']);
    const idxLearn = matchIndex(['学习扣分(0-5分)','基础学习扣分(0-5分)','基础学习(0-5分)','基础学习','学习']);
    const idxDiscip = matchIndex(['纪律扣分(0-10分)','工作纪律扣分(0-10分)','工作纪律(0-10分)','工作纪律','纪律']);
    const idxTotal = matchIndex(['总分','合计','总计']);
    const idxRemark = matchIndex(['备注','说明']);
    if ([idxName, idxAttend, idxLearn, idxDiscip].some(i => i < 0)) {
      message.error('表头缺失或不规范，请参考模板或调整列名');
      return [];
    }
    const dataRows = rawData.slice(dataStartIndex + 1).filter(row => row && row.some(cell => cell !== undefined && cell !== ''));
    return dataRows.map((row, index) => {
      const rowData: any = { key: index };
      rowData['姓名'] = row[idxName];
      rowData['部门'] = idxDept >= 0 ? row[idxDept] : '未分配部门';
      rowData['考勤管理(0-5分)'] = row[idxAttend];
      rowData['基础学习(0-5分)'] = row[idxLearn];
      rowData['工作纪律(0-10分)'] = row[idxDiscip];
      if (idxTotal >= 0) rowData['总分'] = row[idxTotal];
      if (idxRemark >= 0) rowData['备注'] = row[idxRemark];
      rowData.valid = validateRowData(rowData);
      return rowData;
    });
  };

  const pickVal = (obj: any, keys: string[]) => {
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };
  // 验证行数据
  const validateRowData = (rowData: any) => {
    const errors: string[] = [];
    if (!rowData['姓名']) errors.push('姓名不能为空');
    // 部门可选，缺省将自动分配为“未分配部门”
    const attendanceScore = parseFloat(String(pickVal(rowData, ['考勤扣分(0-5分)','考勤管理(0-5分)','考勤管理','考勤']) ?? '').toString().trim());
    if (isNaN(attendanceScore) || attendanceScore < 0 || attendanceScore > 5) {
      errors.push('考勤扣分必须为0-5之间的数字');
    }
    const learningScore = parseFloat(String(pickVal(rowData, ['学习扣分(0-5分)','基础学习(0-5分)','基础学习','学习']) ?? '').toString().trim());
    if (isNaN(learningScore) || learningScore < 0 || learningScore > 5) {
      errors.push('学习扣分必须为0-5之间的数字');
    }
    const disciplineScore = parseFloat(String(pickVal(rowData, ['纪律扣分(0-10分)','工作纪律(0-10分)','工作纪律','纪律']) ?? '').toString().trim());
    if (isNaN(disciplineScore) || disciplineScore < 0 || disciplineScore > 10) {
      errors.push('纪律扣分必须为0-10之间的数字');
    }
    const calculatedTotal = 20 - (attendanceScore + learningScore + disciplineScore);
    const providedTotal = parseFloat(String(rowData['总分'] ?? '').toString().trim());
    if (!isNaN(providedTotal) && Math.abs(providedTotal - calculatedTotal) > 0.1) {
      errors.push(`总分不匹配，应为${calculatedTotal}分`);
    }
    return {
      isValid: errors.length === 0,
      errors,
      calculatedTotal
    };
  };

  const ensureBasicDutyTypes = async () => {
    const { data: existing } = await supabase
      .from('score_types')
      .select('id, name, category')
      .eq('category', 'basic_duty');
    const names = new Set((existing || []).map((t: any) => t.name));
    const needed = [
      { name: '考勤管理', category: 'basic_duty' },
      { name: '基础学习', category: 'basic_duty' },
      { name: '工作纪律', category: 'basic_duty' }
    ].filter(t => !names.has(t.name));
    if (needed.length > 0) {
      await supabase.from('score_types').insert(needed);
    }
  };

  const ensureDepartmentByName = async (name: string) => {
    const deptName = (name || '').trim() || '未分配部门';
    const { data: found } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', deptName)
      .limit(1);
    if (found && found[0]) return found[0].id as string;
    const { data: created } = await supabase
      .from('departments')
      .insert([{ name: deptName, description: '' }])
      .select('id')
      .single();
    return created?.id as string;
  };

  const ensureUserByName = async (name: string, departmentId?: string) => {
    const userName = (name || '').trim();
    const { data: found } = await supabase
      .from('users')
      .select('id, name, email, role, department_id')
      .eq('name', userName)
      .limit(1);
    if (found && found[0]) return found[0];
    const uniqueEmail = `generated_${Date.now()}_${Math.random().toString(36).slice(2)}@local.local`;
    const payload: any = {
      name: userName,
      email: uniqueEmail,
      role: 'employee',
      department_id: departmentId || null
    };
    const { data: created } = await supabase
      .from('users')
      .insert([payload])
      .select('id, name, email, role, department_id')
      .single();
    return created;
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
      if (!basicDutyTypes || basicDutyTypes.length === 0) {
        await ensureBasicDutyTypes();
        const refreshed = await scoreTypeAPI.getScoreTypesByCategory('basic_duty');
        setBasicDutyTypes(refreshed);
      }
      for (const item of validData) {
        try {
          const importUserName = String(item['姓名']).trim();
          let targetUser = allUsers.find(u => String(u.name).trim() === importUserName);
          if (!targetUser) {
            const deptName = String(item['部门'] ?? '').trim();
            const deptId = await ensureDepartmentByName(deptName);
            const ensuredUser = await ensureUserByName(importUserName, deptId);
            if (ensuredUser) {
              targetUser = ensuredUser as any;
              setAllUsers(prev => [...prev, ensuredUser as any]);
            }
          }
          if (!targetUser) throw new Error(`用户 ${importUserName} 不存在`);

          const scorePromises: Promise<any>[] = [];
          // 类型查找
          const attendanceType = basicDutyTypes.find((st: any) => st.name.includes('考勤') || st.name.includes('出勤'));
          const learningType = basicDutyTypes.find((st: any) => st.name.includes('学习') || st.name.includes('培训'));
          const disciplineType = basicDutyTypes.find((st: any) => st.name.includes('纪律') || st.name.includes('规范'));

          const attendanceScore = Number(pickVal(item, ['考勤扣分(0-5分)','考勤管理(0-5分)']));
          if (attendanceType && attendanceScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: attendanceType.id,
              score: -Math.abs(attendanceScore),
              reason: `考勤扣分：${attendanceScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
              recorder_id: user?.id || '',
              period
            }));
          }

          const learningScore = Number(pickVal(item, ['学习扣分(0-5分)','基础学习(0-5分)']));
          if (learningType && learningScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: learningType.id,
              score: -Math.abs(learningScore),
              reason: `学习扣分：${learningScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
              recorder_id: user?.id || '',
              period
            }));
          }

          const disciplineScore = Number(pickVal(item, ['纪律扣分(0-10分)','工作纪律(0-10分)']));
          if (disciplineType && disciplineScore > 0) {
            scorePromises.push(scoreAPI.createScore({
              user_id: targetUser.id,
              score_type_id: disciplineType.id,
              score: -Math.abs(disciplineScore),
              reason: `纪律扣分：${disciplineScore}分${item['备注'] ? ' - ' + item['备注'] : ''}`,
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
        message.error('导入失败：未匹配到积分类型或用户');
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
          <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>基础职责积分模板</Button>
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
            disabled={!canEdit || importData.length === 0}
          >
            导入数据 ({importData.length}条)
          </Button>
        ]}
      >
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">
            {importData.length === 0 ? (
              <>暂无导入数据</>
            ) : (
              <>共 {importData.length} 条数据，其中 {importData.filter((item: any) => item.valid?.isValid).length} 条有效，{importData.filter((item: any) => !item.valid?.isValid).length} 条无效</>
            )}
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
