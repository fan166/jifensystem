import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import MainLayout from './components/Layout/MainLayout';
import PermissionWrapper from './components/PermissionWrapper';
// 动态导入大型页面组件以实现代码分割
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

const BasicDutyScore = lazy(() => import('./components/BasicDutyScore'));
const KeyWorkManagement = lazy(() => import('./pages/KeyWorkManagement'));
const PerformanceReward = lazy(() => import('./pages/PerformanceReward'));
const Personnel = lazy(() => import('./pages/Personnel'));
const Evaluation = lazy(() => import('./pages/Evaluation'));
const PerformanceEvaluation = lazy(() => import('./pages/PerformanceEvaluation'));


const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const Ranking = lazy(() => import('./pages/Ranking'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Notifications = lazy(() => import('./pages/Notifications'));
import { useAuthStore } from './stores/authStore';
import './App.css';

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // 应用启动时检查认证状态
    checkAuth();
  }, [checkAuth]);

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Suspense fallback={<div style={{ padding: 24 }}>页面加载中...</div>}>
          <Routes>
            {/* 公共路由 - 无需认证 */}
            <Route path="/login" element={<Login />} />
            
            {/* 需要认证的路由 */}
            <Route path="/" element={
              <PermissionWrapper permission="read">
                <MainLayout />
              </PermissionWrapper>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* 所有登录用户可访问的页面 */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              
              {/* 积分管理 - 根据角色显示不同内容 */}
              <Route path="basic-duty-score" element={<BasicDutyScore />} />
              <Route path="key-work-management" element={<KeyWorkManagement />} />
              <Route path="performance-reward" element={<PerformanceReward />} />
              
              {/* 考核评价 - 所有用户可访问 */}
              <Route path="evaluation" element={<Evaluation />} />
              <Route path="performance-evaluation" element={<PerformanceEvaluation />} />
              
              {/* 排行榜和分析 - 所有用户可访问 */}
              <Route path="ranking" element={<Ranking />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="notifications" element={<Notifications />} />
              
              {/* 人员管理 - 仅管理员可访问 */}
              <Route path="personnel" element={
                <PermissionWrapper permission="admin">
                  <Personnel />
                </PermissionWrapper>
              } />
              
              {/* 系统设置 - 仅管理员可访问 */}
              <Route path="settings" element={
                <PermissionWrapper permission="admin">
                  <Settings />
                </PermissionWrapper>
              } />
            </Route>
            
            {/* 404 重定向 */}
            <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
          </Routes>
        </Suspense>
      </Router>
    </ConfigProvider>
  );
}

export default App;
