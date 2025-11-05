import React, { useState, useEffect } from 'react';
import { Card, List, Badge, Tabs, Button, Input, Select, Space, Tag, Divider, Modal, Form } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuthStore } from '../stores/authStore';
import { useNotificationsStore, Announcement, AnnouncementPriority, AnnouncementType } from '../stores/notificationsStore';

const { Option } = Select;

const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('write');
  const store = useNotificationsStore();
  const notifications: Announcement[] = store.items;
  const [filteredNotifications, setFilteredNotifications] = useState<Announcement[]>(notifications);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    store.fetch();
    store.subscribe();
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, searchText, filterType, filterCategory, activeTab]);

  const filterNotifications = () => {
    let filtered = [...notifications];

    // 根据标签页筛选
    if (activeTab === 'unread') {
      filtered = filtered.filter(item => !item.is_read);
    } else if (activeTab === 'read') {
      filtered = filtered.filter(item => item.is_read);
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
      // 若后端未提供 category 字段，则用 type 充当分类
      filtered = filtered.filter(item => (item as any).category ? (item as any).category === filterCategory : item.type === filterCategory);
    }

    setFilteredNotifications(filtered);
  };

  const markAsRead = (id: string) => {
    store.markRead(id);
  };

  const markAllAsRead = () => {
    store.markAllRead();
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

  const unreadCount = store.unreadCount;
  const categories = [...new Set(notifications.map(item => (item as any).category ?? item.type))];

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (item: Announcement) => {
    setEditing(item);
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      priority: item.priority,
    });
    setModalOpen(true);
  };

  const submitForm = async () => {
    const values = await form.validateFields();
    const payload: Partial<Announcement> & { type?: AnnouncementType } = {
      title: values.title,
      content: values.content,
      priority: values.priority as AnnouncementPriority,
      // 类型字段已移除：创建时使用默认值，编辑时保持原值
      type: editing ? editing.type : 'info',
    };
    if (editing) {
      const { type, ...rest } = payload; // 更新时不强制覆盖类型
      await store.update(editing.id, rest as Partial<Announcement>);
    } else {
      await store.create(payload as any);
    }
    setModalOpen(false);
  };

  const deleteItem = async (id: string) => {
    await store.remove(id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-end mb-6">
        <Space>
          <Button 
            type="primary" 
            icon={<CheckCircleOutlined />}
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            全部标记为已读
          </Button>
          {canManage && (
            <Button type="primary" onClick={openCreate}>发布新公告</Button>
          )}
        </Space>
      </div>

      {/* 筛选和搜索区域已移除 */}

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
                !item.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
              onClick={() => markAsRead(item.id)}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={!item.is_read ? 'font-bold text-gray-900' : 'text-gray-700'}>
                        {item.title}
                      </span>
                      {!item.is_read && (
                        <Badge status="processing" text="新" />
                      )}
                      <Tag color={getPriorityColor(item.priority)}>
                        {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                      </Tag>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        status={getStatusColor(item.type) as any} 
                        text={item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                      />
                    </div>
                  </div>
                }
                description={
                  <div className={!item.is_read ? 'text-gray-700' : 'text-gray-500'}>
                    {item.content}
                  </div>
                }
              />
              {canManage && (
                <Space>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); openEdit(item); }}>编 辑</Button>
                  <Button size="small" danger onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}>删 除</Button>
                </Space>
              )}
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={editing ? '编辑公告' : '发布新公告'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitForm}
        okText={editing ? '保存' : '发布'}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={4} placeholder="请输入公告内容" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Option value="high">高</Option>
              <Option value="medium">中</Option>
              <Option value="low">低</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Notifications;