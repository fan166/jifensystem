import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Typography, Row, Col, Tabs, Button, Input, Select, DatePicker, Space, Tag, Divider } from 'antd';
import {
  BellOutlined,
  SearchOutlined,
  FilterOutlined,
  CheckOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

interface Notification {
  id: number;
  title: string;
  content: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: string;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
}

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([
    { 
      id: 1, 
      title: '月度考核通知', 
      content: '请各科室按时提交11月份考核材料，截止时间为本月25日', 
      time: '2024-01-15', 
      type: 'info',
      category: '考核通知',
      isRead: false,
      priority: 'high'
    },
    { 
      id: 2, 
      title: '表彰通报', 
      content: '恭喜您在上月工作中表现优秀，获得绩效奖励积分10分', 
      time: '2024-01-14', 
      type: 'success',
      category: '表彰奖励',
      isRead: true,
      priority: 'medium'
    },
    { 
      id: 3, 
      title: '督查提醒', 
      content: '请注意考勤管理，避免迟到早退，保持良好的工作纪律', 
      time: '2024-01-13', 
      type: 'warning',
      category: '督查提醒',
      isRead: false,
      priority: 'medium'
    },
    { 
      id: 4, 
      title: '系统维护通知', 
      content: '系统将于本周六晚上22:00-24:00进行维护升级，期间可能无法正常访问', 
      time: '2024-01-12', 
      type: 'info',
      category: '系统通知',
      isRead: true,
      priority: 'low'
    },
    { 
      id: 5, 
      title: '积分规则更新', 
      content: '积分制管理办法已更新，请及时查看新的评分标准和奖惩规则', 
      time: '2024-01-10', 
      type: 'info',
      category: '规则更新',
      isRead: false,
      priority: 'high'
    }
  ]);
  
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>(notifications);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    filterNotifications();
  }, [notifications, searchText, filterType, filterCategory, activeTab]);

  const filterNotifications = () => {
    let filtered = [...notifications];

    // 根据标签页筛选
    if (activeTab === 'unread') {
      filtered = filtered.filter(item => !item.isRead);
    } else if (activeTab === 'read') {
      filtered = filtered.filter(item => item.isRead);
    }

    // 搜索筛选
    if (searchText) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(searchText.toLowerCase()) ||
        item.content.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 类型筛选
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // 分类筛选
    if (filterCategory !== 'all') {
      filtered = filtered.filter(item => item.category === filterCategory);
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(item => 
        item.id === id ? { ...item, isRead: true } : item
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(item => ({ ...item, isRead: true }))
    );
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'processing';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const unreadCount = notifications.filter(item => !item.isRead).length;
  const categories = [...new Set(notifications.map(item => item.category))];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Title level={2} className="mb-0 flex items-center">
          <BellOutlined className="mr-2 text-blue-600" />
          通知公告
        </Title>
        <Button 
          type="primary" 
          icon={<CheckCircleOutlined />}
          onClick={markAllAsRead}
          disabled={unreadCount === 0}
        >
          全部标记为已读
        </Button>
      </div>

      {/* 筛选和搜索区域 */}
      <Card className="mb-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索通知标题或内容"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="通知类型"
              value={filterType}
              onChange={setFilterType}
              style={{ width: '100%' }}
            >
              <Option value="all">全部类型</Option>
              <Option value="info">信息</Option>
              <Option value="success">成功</Option>
              <Option value="warning">警告</Option>
              <Option value="error">错误</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="通知分类"
              value={filterCategory}
              onChange={setFilterCategory}
              style={{ width: '100%' }}
            >
              <Option value="all">全部分类</Option>
              {categories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 通知列表 */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: `全部通知 (${notifications.length})`,
            },
            {
              key: 'unread',
              label: (
                <span>
                  未读通知 
                  {unreadCount > 0 && (
                    <Badge count={unreadCount} size="small" className="ml-1" />
                  )}
                </span>
              ),
            },
            {
              key: 'read',
              label: `已读通知 (${notifications.length - unreadCount})`,
            }
          ]}
        >
        </Tabs>
        
        <List
          dataSource={filteredNotifications}
          locale={{ emptyText: '暂无通知' }}
          renderItem={(item) => (
            <List.Item 
              className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                !item.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => markAsRead(item.id)}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={!item.isRead ? 'font-bold text-gray-900' : 'text-gray-700'}>
                        {item.title}
                      </span>
                      {!item.isRead && (
                        <Badge status="processing" text="新" />
                      )}
                      <Tag color={getPriorityColor(item.priority)}>
                        {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                      </Tag>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Tag color={getStatusColor(item.type)}>{item.category}</Tag>
                      <Badge 
                        status={getStatusColor(item.type) as any} 
                        text={item.time}
                      />
                    </div>
                  </div>
                }
                description={
                  <div className={!item.isRead ? 'text-gray-700' : 'text-gray-500'}>
                    {item.content}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default Notifications;