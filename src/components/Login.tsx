import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Space, Typography, Divider } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [demoMode, setDemoMode] = useState(false);

  const handleLogin = async (values: LoginFormData) => {
    try {
      await login(values.email, values.password);
      message.success('登录成功！');
      navigate('/');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    }
  };

  const handleDemoLogin = async (role: 'system_admin' | 'assessment_admin' | 'employee') => {
    const demoUsers = {
      system_admin: { email: 'admin@company.com', password: 'admin123' },
      assessment_admin: { email: 'manager@company.com', password: 'manager123' },
      employee: { email: 'employee@company.com', password: 'employee123' }
    };

    const account = demoUsers[role];
    form.setFieldsValue(account);
    
    try {
      await login(account.email, account.password);
      message.success(`以${role === 'system_admin' ? '系统管理员' : role === 'assessment_admin' ? '考核办管理员' : '普通职工'}身份登录成功！`);
      navigate('/');
    } catch (error) {
      message.error('演示登录失败，请检查用户数据');
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LoginOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
          <Title level={2} style={{ margin: 0 }}>积分制绩效管理系统</Title>
          <Text type="secondary">请登录您的账户</Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="请输入邮箱" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="请输入密码" 
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={isLoading}
              block
              style={{ height: 44 }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <Divider>演示账户</Divider>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center', display: 'block' }}>
            点击下方按钮快速体验不同角色功能
          </Text>
          
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button 
              size="small" 
              onClick={() => handleDemoLogin('system_admin')}
              loading={isLoading}
            >
              管理员
            </Button>
            <Button 
              size="small" 
              onClick={() => handleDemoLogin('assessment_admin')}
              loading={isLoading}
            >
              经理
            </Button>
            <Button 
              size="small" 
              onClick={() => handleDemoLogin('employee')}
              loading={isLoading}
            >
              员工
            </Button>
          </Space>
        </Space>

        {demoMode && (
          <div style={{ marginTop: 16, padding: 12, background: '#f6f8fa', borderRadius: 6 }}>
            <Text style={{ fontSize: '12px', color: '#666' }}>
              <strong>演示账户信息：</strong><br/>
              系统管理员: admin@company.com / admin123<br/>
              考核办管理员: manager@company.com / manager123<br/>
              员工: employee@company.com / employee123
            </Text>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button 
            type="link" 
            size="small" 
            onClick={() => setDemoMode(!demoMode)}
          >
            {demoMode ? '隐藏' : '显示'}演示账户信息
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Login;