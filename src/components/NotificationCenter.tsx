import React, { useState, useEffect } from 'react';
import { Badge, Dropdown, List, Button, Empty, Typography, Space, Tag } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';

const { Text } = Typography;

interface Notification {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const NotificationCenter: React.FC = () => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // 模拟获取通知数据
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockNotifications: Notification[] = [
        {
          id: '1',
          title: '积分更新通知',
          content: '您的基本职责积分已更新，新增5分',
          type: 'success',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30分钟前
          actionUrl: '/dashboard'
        },
        {
          id: '2',
          title: '任务提醒',
          content: '您有一个重点工作任务即将到期，请及时处理',
          type: 'warning',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2小时前
          actionUrl: '/key-work'
        },
        {
          id: '3',
          title: '系统公告',
          content: '积分管理系统将于本周末进行维护升级',
          type: 'info',
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1天前
        }
      ];
      setNotifications(mockNotifications);
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const getTypeColor = (type: string) => {
    const colorMap = {
      info: 'blue',
      success: 'green',
      warning: 'orange',
      error: 'red'
    };
    return colorMap[type as keyof typeof colorMap] || 'blue';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return `${days}天前`;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const notificationList = (
    <div className="w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border">
      <div className="p-3 border-b flex justify-between items-center">
        <Text strong>消息通知</Text>
        {unreadCount > 0 && (
          <Button 
            type="link" 
            size="small" 
            onClick={markAllAsRead}
            icon={<CheckOutlined />}
          >
            全部已读
          </Button>
        )}
      </div>
      
      {notifications.length === 0 ? (
        <div className="p-4">
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="暂无通知" 
          />
        </div>
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              className={`px-3 py-2 hover:bg-gray-50 cursor-pointer ${
                !item.read ? 'bg-blue-50' : ''
              }`}
              onClick={() => {
                markAsRead(item.id);
                if (item.actionUrl) {
                  window.location.href = item.actionUrl;
                }
              }}
              actions={[
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                />
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong={!item.read}>{item.title}</Text>
                    <Tag color={getTypeColor(item.type)}>
                      {item.type === 'info' && '信息'}
                      {item.type === 'success' && '成功'}
                      {item.type === 'warning' && '警告'}
                      {item.type === 'error' && '错误'}
                    </Tag>
                    {!item.read && <Badge status="processing" />}
                  </Space>
                }
                description={
                  <div>
                    <Text className="text-sm text-gray-600">{item.content}</Text>
                    <br />
                    <Text className="text-xs text-gray-400">{formatTime(item.createdAt)}</Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
      
      {notifications.length > 0 && (
        <div className="p-3 border-t text-center">
          <Button type="link" size="small">
            查看全部通知
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown 
      trigger={['click']} 
      placement="bottomLeft"
      popupRender={() => notificationList}
      overlayStyle={{ 
        marginRight: '16px',
        marginTop: '8px',
        marginLeft: '16px',
        marginBottom: '16px'
      }}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
    >
      <Badge count={unreadCount} size="small">
        <Button 
          type="text" 
          icon={<BellOutlined />} 
          className="flex items-center justify-center"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationCenter;