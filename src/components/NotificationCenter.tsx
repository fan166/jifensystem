import React, { useEffect } from 'react';
import { Dropdown, List, Button, Empty, Typography, Space, Tag, Badge } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useNotificationsStore } from '../stores/notificationsStore';

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
  const notificationsStore = useNotificationsStore();
  const notifications = notificationsStore.items.map(item => ({
    id: item.id,
    title: item.title,
    content: item.content,
    type: item.type,
    read: item.is_read,
    createdAt: item.created_at,
    actionUrl: undefined
  }));
  const loading = notificationsStore.loading;

  // 获取与订阅公告
  useEffect(() => {
    if (user) {
      notificationsStore.fetch();
      notificationsStore.subscribe();
    }
  }, [user]);

  const markAsRead = (id: string) => {
    notificationsStore.markRead(id);
  };

  const markAllAsRead = () => {
    notificationsStore.markAllRead();
  };

  const deleteNotification = (id: string) => {
    // 删除仅管理员可见，员工不显示按钮（在渲染中控制）。这里调用store删除。
    notificationsStore.remove(id);
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

  const unreadCount = notificationsStore.unreadCount;

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
      <Button 
        type="text" 
        icon={<BellOutlined />} 
        className="flex items-center justify-center"
      />
    </Dropdown>
  );
};

export default NotificationCenter;