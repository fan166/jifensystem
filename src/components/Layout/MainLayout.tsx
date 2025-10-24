import React, { useState, useEffect } from 'react';
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
import { useAuthStore, getRoleDisplayName } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [personalScoreVisible, setPersonalScoreVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasPermission } = useAuthStore();
  const { user: authUser, loading } = useAuth();

  // 检查认证状态
  useEffect(() => {
    if (!loading && !authUser) {
      navigate('/login');
    }
  }, [authUser, loading, navigate]);

  // 如果正在加载或未认证，显示加载状态
  if (loading || !authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  // 基于用户权限动态生成菜单
  const getMenuItems = (): MenuProps['items'] => {
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '个人主页',
      },
      {
        key: 'score-menu',
        icon: <TrophyOutlined />,
        label: '积分管理',
        children: [
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
        ],
      },
      {        key: '/analytics',        icon: <BarChartOutlined />,        label: '趋势分析',      },      {        key: '/notifications',        icon: <BellOutlined />,        label: '通知公告',      },    ];

    // 管理员和经理可以看到的菜单项
    // 结果运用模块已移除

    // 仅管理员可以看到的菜单项
    if (hasPermission('admin')) {
      baseItems.push(
        {
          key: '/settings',
          icon: <SettingOutlined />,
          label: '系统设置',
          children: [
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
      '/dashboard': '个人主页',
      '/basic-duty-score': '基本职责积分',
      '/performance-evaluation': '工作实绩积分',
      '/key-work-management': '重点工作积分',
      '/performance-reward': '绩效奖励积分',
      '/analytics': '趋势分析',
      '/notifications': '通知公告',
      '/personnel': '人员管理',
      '/settings': '系统设置',
      '/profile': '个人中心',
    };

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbItems = [{ title: '首页' }];

    if (location.pathname !== '/dashboard') {
      // 特殊处理人员管理页面，显示系统设置 > 人员管理
      if (location.pathname === '/personnel') {
        breadcrumbItems.push({ title: '系统设置' });
        breadcrumbItems.push({ title: '人员管理' });
      } else {
        const currentPageTitle = pathMap[location.pathname] || '未知页面';
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
              <Title level={4} className="text-blue-600 mb-0">
                积分制管理系统
              </Title>
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
                    {getRoleDisplayName(user.role)}
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