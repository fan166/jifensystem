import React, { useState } from 'react';
import { Card, Tabs, Alert } from 'antd';
import { UserOutlined, TeamOutlined, SettingOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { PermissionSettings } from '../components/PermissionSettings';
import { PersonalScoreView } from '../components/PersonalScoreView';
import { DailyEvaluationTab } from '../components/DailyEvaluationTab';
import { AnnualEvaluationTab } from '../components/AnnualEvaluationTab';
import { FinalScoreStatistics } from '../components/FinalScoreStatistics';

const PerformanceEvaluationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const { user, isAuthenticated } = useAuthStore();
  
  // 基于用户角色的权限检查
  const isAdmin = user?.role === 'system_admin';
  const isManager = user?.role === 'assessment_admin';
  const hasAdminAccess = isAdmin || isManager;
  
  // 调试信息
  React.useEffect(() => {
    console.debug('=== 权限调试信息 ===');
    console.debug('用户信息:', user);
    console.debug('用户角色:', user?.role);
    console.debug('是否已认证:', isAuthenticated);
    console.debug('是否管理员:', isAdmin);
    console.debug('是否考核办管理员:', isManager);
    console.debug('是否有管理员访问权限:', hasAdminAccess);
    console.debug('==================');
  }, [user, isAuthenticated, isAdmin, isManager, hasAdminAccess]);

  // 生成Tab项
  const generateTabItems = () => {
    const items = [];

    // 日常实绩评价 - 管理员和领导可以评价他人
    if (hasAdminAccess || user?.role === 'leader') {
      items.push({
        key: 'daily',
        label: (
          <span>
            <UserOutlined />
            日常实绩评价
          </span>
        ),
        children: <DailyEvaluationTab />
      });
    }

    // 年终集体测评 - 所有用户都可以参与
    items.push({
      key: 'annual',
      label: (
        <div>
          <TeamOutlined />
          年终集体测评
        </div>
      ),
      children: <AnnualEvaluationTab />
    });

    // 我的积分 - 除系统管理员外的所有用户都可以查看自己的积分
    if (!isAdmin) {
      items.push({
        key: 'personal',
        label: (
          <span>
            <BarChartOutlined />
            我的积分
          </span>
        ),
        children: <PersonalScoreView />
      });
    }

    // 最终积分统计 - 管理员可见
    if (hasAdminAccess) {
      items.push({
        key: 'statistics',
        label: (
          <span>
            <BarChartOutlined />
            最终积分统计
          </span>
        ),
        children: <FinalScoreStatistics />
      });
    }

    // 权限设置 - 仅系统管理员可见
    if (isAdmin) {
      items.push({
        key: 'permissions',
        label: (
          <span>
            <SettingOutlined />
            权限设置
          </span>
        ),
        children: <PermissionSettings />
      });
    }

    return items;
  };

  // 检查认证状态
  if (!isAuthenticated) {
    return (
      <Card title="工作实绩积分" className="h-full">
        <Alert
          message="未登录"
          description="请先登录系统以访问此模块。"
          type="warning"
          showIcon
        />
      </Card>
    );
  }

  // 检查是否有访问权限（所有已认证用户都可以访问）
  if (!user) {
    return (
      <Card title="工作实绩积分" className="h-full">
        <Alert
          message="用户信息获取失败"
          description="无法获取用户信息，请重新登录。"
          type="error"
          showIcon
        />
      </Card>
    );
  }
  
  return (
    <div className="p-6">
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={generateTabItems()}
          size="large"
        />
      </Card>
    </div>
  );
};

export default PerformanceEvaluationPage;