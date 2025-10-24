import React, { useState } from 'react';
import { Card, Tabs, Button, Space } from 'antd';
import { FileTextOutlined, AuditOutlined, StarOutlined, BarChartOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import TaskSubmission from '../components/TaskSubmission';
import TaskReview from '../components/TaskReview';
import TaskEvaluation from '../components/TaskEvaluation';
import EvaluationStatistics from '../components/EvaluationStatistics';

// const { TabPane } = Tabs; // 已废弃，使用items属性

const EvaluationPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('submission');
  
  // 判断用户角色权限
  const isAdmin = user?.role === 'system_admin';
  const isRegularUser = user?.role === 'employee';

  const tabItems = [
    {
      key: 'submission',
      label: (
        <span>
          <FileTextOutlined />
          任务报备
        </span>
      ),
      children: <TaskSubmission />,
      disabled: false
    },
    {
      key: 'review',
      label: (
        <span>
          <AuditOutlined />
          任务审核
        </span>
      ),
      children: <TaskReview />,
      disabled: !isAdmin // 只有管理员可以访问
    },
    {
      key: 'evaluation',
      label: (
        <span>
          <StarOutlined />
          集体评分
        </span>
      ),
      children: <TaskEvaluation />,
      disabled: false
    },
    {
      key: 'statistics',
      label: (
        <span>
          <BarChartOutlined />
          评分统计
        </span>
      ),
      children: <EvaluationStatistics />,
      disabled: false
    }
  ];

  // 过滤掉被禁用的标签页
  const availableTabs = tabItems.filter(tab => !tab.disabled);

  return (
    <div className="p-6 bg-white">
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">工作实绩积分管理</h1>
            <p className="text-gray-500 mt-2">
              管理工作任务报备、审核、集体评分和统计分析
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">
              当前用户：{user?.name}
            </div>
            <div className="text-sm text-gray-500">
              角色：{user?.role === 'system_admin' ? '系统管理员' :
        user?.role === 'assessment_admin' ? '考核办管理员' : '普通职工'}
            </div>
          </div>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          type="card"
          size="large"
          items={availableTabs.map(tab => ({
            key: tab.key,
            label: tab.label,
            children: tab.children
          }))}
        />
      </Card>
    </div>
  );
};

export default EvaluationPage;