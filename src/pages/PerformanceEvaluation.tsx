import React, { useState, useEffect, lazy } from 'react';
import { Card, Tabs, Alert } from 'antd';
import { UserOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useEvaluationVisibility } from '../hooks/useEvaluationVisibility';
// 懒加载大型组件（命名导出需要映射为默认导出）
const PersonalScoreView = lazy(() => import('../components/PersonalScoreView').then(m => ({ default: m.PersonalScoreView })));
const DailyEvaluationTab = lazy(() => import('../components/DailyEvaluationTab').then(m => ({ default: m.DailyEvaluationTab })));
const AnnualEvaluationTab = lazy(() => import('../components/AnnualEvaluationTab').then(m => ({ default: m.AnnualEvaluationTab })));
const FinalScoreStatistics = lazy(() => import('../components/FinalScoreStatistics').then(m => ({ default: m.FinalScoreStatistics })));

const PerformanceEvaluationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('daily');
  const { user, isAuthenticated } = useAuthStore();
  const { dailyVisible, annualVisible, loading: visibilityLoading } = useEvaluationVisibility();
  
  // 基于用户角色的权限检查
  const isAdmin = user?.role === 'system_admin';
  const isManager = user?.role === 'assessment_admin';
  const isLeader = user?.role === 'leader';
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
    if (hasAdminAccess || isLeader) {
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

    // 日常实绩评价 - 普通用户可见性受开关控制
    if (isAuthenticated && !hasAdminAccess && user?.role === 'employee' && dailyVisible) {
      items.push({
        key: 'daily-performance',
        label: (
          <span>
            <UserOutlined />
            日常实绩评价
          </span>
        ),
        children: <DailyEvaluationTab />
      });
    }

    // 年终集体测评 - 普通用户可见性受开关控制；管理员和领导不受影响
    if (hasAdminAccess || isLeader || (user?.role === 'employee' && annualVisible)) {
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

    // 权限设置已迁移至“系统设置”页面，不再在此展示

    return items;
  };

  // 纠正选中Tab：当可用项变化导致当前key不存在时，回退到首个或“我的积分”
  useEffect(() => {
    const items = generateTabItems();
    const exists = items.some(item => item.key === activeTab);
    if (!exists) {
      const fallback = items[0]?.key || (!isAdmin ? 'personal' : undefined);
      if (fallback) setActiveTab(fallback);
    }
  }, [dailyVisible, annualVisible, user?.role, isLeader]);

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
        {user?.role === 'employee' && !visibilityLoading && !dailyVisible && !annualVisible && (
          <Alert
            message="当前模块已隐藏"
            description="系统管理员已禁用普通职工的日常与年终测评入口。"
            type="info"
            showIcon
            className="mb-3"
          />
        )}
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