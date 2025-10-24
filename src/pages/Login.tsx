import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      // 使用 Supabase 认证
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // 如果登录成功，从用户元数据创建用户对象
      if (data.user) {
        const userMetadata = data.user.user_metadata || {};
        const userRole = userMetadata.role || 'employee';
        
        // 角色映射
        const roleMapping = {
          'admin': 'system_admin',
          'manager': 'assessment_admin',
          'employee': 'employee'
        };

        const mappedUser = {
          id: data.user.id,
          email: data.user.email || '',
          name: userMetadata.name || '用户',
          role: roleMapping[userRole as keyof typeof roleMapping] || 'employee',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at
        };

        // 设置用户状态
        setUser(mappedUser);
        
        // 清除可能存在的临时用户数据
        localStorage.removeItem('temp_user');
      }

      toast.success('登录成功');
      navigate('/');
    } catch (error) {
      console.error('登录失败:', error);
      toast.error('登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  // 临时登录功能（开发环境）
  const handleTempLogin = async () => {
    setLoading(true);
    try {
      // 创建一个临时用户会话
      const tempUser = {
        id: 'temp-user-id',
        email: 'admin@example.com',
        name: '管理员',
        role: 'system_admin'
      };
      
      // 存储到localStorage作为临时解决方案
      localStorage.setItem('temp_user', JSON.stringify(tempUser));
      
      // 同时设置到Zustand store中
      setUser(tempUser);
      
      toast.success('临时登录成功');
      navigate('/');
    } catch (error) {
      console.error('临时登录失败:', error);
      toast.error('临时登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <LogIn className="h-6 w-6" />
            积分制绩效管理系统
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            <div className="border border-input bg-background rounded-md p-2 shadow-sm">
              <Button type="submit" className="w-full border-0 bg-transparent hover:bg-accent hover:text-accent-foreground" disabled={loading}>
                {loading ? '登录中...' : '登录'}
              </Button>
            </div>
          </form>
          
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleTempLogin}
              disabled={loading}
            >临时登录（开发环境）</Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              临时登录功能仅用于开发测试
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}