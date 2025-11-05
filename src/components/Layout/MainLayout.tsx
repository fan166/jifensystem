import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Typography, Tag, Breadcrumb, Space } from 'antd';
import {
  DashboardOutlined,
  TrophyOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
  FlagOutlined,
  GiftOutlined,
  BarChartOutlined,
  PieChartOutlined,
  FileTextOutlined,
  RocketOutlined,
  StarOutlined,
  TeamOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import NotificationCenter from '../NotificationCenter';
import PersonalScore from '../PersonalScore';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { MenuProps } from 'antd';
import { useEvaluationVisibility } from '../../hooks/useEvaluationVisibility';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [personalScoreVisible, setPersonalScoreVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const { dailyVisible, annualVisible, loading: visibilityLoading } = useEvaluationVisibility();

  // 基于用户权限动态生成菜单
  const getMenuItems = (): MenuProps['items'] => {
    const baseItems = [
      {
        key: 'dashboard-menu',
        icon: <DashboardOutlined />,
        label: '首页仪表板',
        children: [
          {
            key: '/ranking',
            icon: <TrophyOutlined />,
            label: '积分排行榜',
          },
          {
            key: '/analytics',
            icon: <BarChartOutlined />,
            label: '趋势分析',
          },
        ],
      },
      // “积分管理”子菜单稍后插入，允许按可见性动态隐藏入口
    ];

    // 基于可见性动态生成“积分管理”菜单
    let scoreChildren: NonNullable<MenuProps['items']> = [
      {
        key: '/my-score-details',
        icon: <TrophyOutlined />,
        label: '我的积分详情',
      },
      {
        key: '/basic-duty-score',
        icon: <UserOutlined />,
        label: '基本职责积分',
      },
      {
        key: '/performance-evaluation',
        icon: <FileTextOutlined />,
        label: '工作实绩积分',
      },
      {
        key: '/key-work-management',
        icon: <RocketOutlined />,
        label: '重点工作积分',
      },
      {
        key: '/performance-reward',
        icon: <GiftOutlined />,
        label: '绩效奖励积分',
      },
    ];

    // 普通职工在两个开关都关闭时隐藏“工作实绩积分”入口
    if (user?.role === 'employee' && !visibilityLoading && !dailyVisible && !annualVisible) {
      scoreChildren = scoreChildren.filter(item => item && (item as any).key !== '/performance-evaluation');
    }

    baseItems.push({
      key: 'score-menu',
      icon: <TrophyOutlined />,
      label: '积分管理',
      children: scoreChildren,
    });

    // 所有角色都可见的“通知公告”，位置在“系统设置”上方
    baseItems.push({
      key: '/notifications',
      icon: <BellOutlined />,
      label: '通知公告',
    });

    // 管理员和经理可以看到的菜单项
    if (hasPermission('write')) {
      // 移除了统计分析和结果运用菜单项
    }

    // 仅管理员可以看到的菜单项
    if (hasPermission('admin')) {
      baseItems.push(
        {
          key: 'settings-menu',
          icon: <SettingOutlined />,
          label: '系统设置',
          children: [
            {
              key: '/settings',
              icon: <SettingOutlined />,
              label: '测评权限设置',
            },
            {
              key: '/personnel',
              icon: <TeamOutlined />,
              label: '人员管理',
            },
          ],
        }
      );
    }

    return baseItems;
  };

  const menuItems = getMenuItems();

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'my-scores',
      icon: <TrophyOutlined />,
      label: '我的积分',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: '消息通知',
      onClick: () => navigate('/notifications'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        navigate('/profile');
        break;
      case 'my-score':
        setPersonalScoreVisible(true);
        break;
      case 'notifications':
        // 通知功能已集成到NotificationCenter组件中
        break;
      case 'logout':
        logout();
        navigate('/login');
        break;
      default:
        navigate(key);
        break;
    }
  };

  // 生成面包屑导航
  const getBreadcrumbItems = () => {
    const pathMap: Record<string, string> = {
      '/analytics': '趋势分析',
      '/my-score-details': '我的积分详情',
      '/basic-duty-score': '基本职责积分',
      '/performance-evaluation': '工作实绩积分',
      '/key-work-management': '重点工作积分',
      '/performance-reward': '绩效奖励积分',
      '/ranking': '积分排行榜',
      '/personnel': '人员管理',
      '/settings': '系统设置',
      '/profile': '个人中心',
    };

    const pathSegments = location.pathname.split('/').filter(Boolean);
    // 通知公告页面将面包屑根项改为“通知公告”
    const breadcrumbItems = [{ title: location.pathname === '/notifications' ? '通知公告' : '首页' }];

    // 为仪表板相关页面添加层级导航
    if (location.pathname === '/analytics' || location.pathname === '/ranking') {
      breadcrumbItems.push({ title: '首页仪表板' });
      const currentPageTitle = pathMap[location.pathname] || '未知页面';
      breadcrumbItems.push({ title: currentPageTitle });
    } else {
      const currentPageTitle = pathMap[location.pathname] || '未知页面';
      if (currentPageTitle !== '未知页面') {
        breadcrumbItems.push({ title: currentPageTitle });
      }
    }

    return breadcrumbItems;
  };

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        className="bg-white shadow-lg"
        width={240}
        collapsedWidth={80}
      >
        <div className="p-4 text-center border-b border-gray-100">
          {!collapsed ? (
            <div className="flex items-center justify-center space-x-2">
              <TrophyOutlined className="text-blue-600 text-xl" />
              <Title level={4} className="text-blue-600 mb-0">积分制绩效管理系统</Title>
            </div>
          ) : (
            <TrophyOutlined className="text-blue-600 text-2xl" />
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 h-full"
          style={{
            borderRight: 'none',
            background: 'transparent'
          }}
        />
      </Sider>
      
      <Layout>
        <Header className="bg-white shadow-sm px-4">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center space-x-4">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                className="text-lg"
              />
              <Breadcrumb items={getBreadcrumbItems()} />
            </div>
            
            <div className="flex items-center space-x-4">
              <Space size="middle">
                <NotificationCenter />
                <span className="text-gray-600">欢迎，{user?.name || '用户'}</span>
                {user?.role && (
                  <Tag color={
                    user.role === 'system_admin' ? 'red' :
              user.role === 'assessment_admin' ? 'blue' : 'green'
                  }>
                    {user.role === 'system_admin' ? '系统管理员' :
            user.role === 'assessment_admin' ? '考核办管理员' : '普通职工'}
                  </Tag>
                )}
                <Dropdown
                  menu={{ items: userMenuItems }}
                  placement="bottomRight"
                  arrow
                >
                  <Avatar
                    size="default"
                    icon={<UserOutlined />}
                    className="cursor-pointer bg-blue-500 hover:bg-blue-600 transition-colors"
                  />
                </Dropdown>
              </Space>
            </div>
          </div>
        </Header>
        
        <Content className="bg-gray-50">
          <Outlet />
        </Content>
      </Layout>
      
      {/* 个人积分弹窗 */}
      <PersonalScore 
        visible={personalScoreVisible}
        onClose={() => setPersonalScoreVisible(false)}
      />
    </Layout>
  );
};

export default MainLayout;