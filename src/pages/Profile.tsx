import React, { useState } from 'react';
import { Card, Typography, Form, Input, Upload, Button, message, Avatar, Space, Row, Col, Descriptions, Tag } from 'antd';
import { supabase } from '../lib/supabase';
import { userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { UploadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Profile: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [pwdForm] = Form.useForm();
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const handlePasswordChange = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoadingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.newPassword });
      if (error) throw error;
      message.success('密码修改成功');
      pwdForm.resetFields();
    } catch (e: any) {
      message.error('密码修改失败：' + (e.message || '未知错误'));
    } finally {
      setLoadingPwd(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return false;
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const url = data.publicUrl;
      setAvatarUrl(url);
      await userAPI.updateUser(user.id, { avatar: url } as any);
      setUser({ ...user, updated_at: new Date().toISOString() } as any);
      message.success('头像更新成功');
    } catch (e: any) {
      message.error('头像上传失败：' + (e.message || '未知错误'));
    }
    return false;
  };

  return (
    <div className="p-6">
      <Row gutter={16}>
        <Col xs={24} md={10}>
          <Card>
            <Title level={3} style={{ marginBottom: 16 }}>我的资料</Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar size={64} src={avatarUrl}>{user?.name?.[0] || 'U'}</Avatar>
              <Upload beforeUpload={handleAvatarUpload} showUploadList={false} accept="image/*">
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
            </div>
            <Descriptions bordered size="small" column={1} style={{ marginTop: 16 }}>
              <Descriptions.Item label="姓名">{user?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色">
                <Tag color="blue">{user?.role || '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card>
            <Title level={3} style={{ marginBottom: 16 }}>安全设置</Title>
            <Form form={pwdForm} layout="vertical" onFinish={handlePasswordChange}>
              <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
                <Input.Password placeholder="请输入新密码" />
              </Form.Item>
              <Form.Item label="确认密码" name="confirmPassword" rules={[{ required: true, message: '请再次输入新密码' }]}>
                <Input.Password placeholder="请再次输入新密码" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={loadingPwd}>修改密码</Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;
