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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  // 解析账号为邮箱（支持输入用户名）
  const resolveEmail = async (id: string): Promise<string> => {
    if (id.includes('@')) return id.trim();
    const { data: byName } = await supabase
      .from('users')
      .select('email, name')
      .eq('name', id.trim())
      .limit(1)
      .maybeSingle();
    if (byName?.email) return byName.email;
    const { data: byEmail } = await supabase
      .from('users')
      .select('email')
      .eq('email', id.trim())
      .limit(1)
      .maybeSingle();
    if (byEmail?.email) return byEmail.email;
    return id.trim();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('请输入账号（邮箱或用户名）和密码');
      return;
    }

    setLoading(true);
    try {

      const email = await resolveEmail(identifier);

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
          admin: 'system_admin',
          manager: 'assessment_admin',
          employee: 'employee'
        } as const;

        const mappedUser = {
          id: data.user.id,
          email: data.user.email || '',
          name: userMetadata.name || '用户',
          role: roleMapping[userRole as keyof typeof roleMapping] || 'employee',
          created_at: data.user.created_at,
          updated_at: data.user.updated_at || data.user.created_at
        };

        setUser(mappedUser as any);
        localStorage.removeItem('temp_user');
      }

      toast.success('登录成功');
      navigate('/');
    } catch (error) {
      console.error('登录失败:', error);
      const msg = (error as any)?.message || '';
      if (/Invalid login credentials/i.test(msg)) {
        toast.error('账号或密码不正确，请重试');
      } else if (/Email not confirmed/i.test(msg)) {
        setNeedsEmailConfirm(true);
        toast.error('邮箱未确认，请点击下方“发送确认邮件”或在控制台确认邮箱后重试');
      } else {
        toast.error('登录失败，请检查账号（邮箱或用户名）和密码');
      }

      // 禁止演示模式或临时登录回退
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirm = async () => {
    try {
      const email = await resolveEmail(identifier);
      const { data, error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      toast.success('确认邮件已发送，请前往邮箱完成确认');
    } catch (e: any) {
      toast.error('发送确认邮件失败：' + (e.message || '未知错误'));
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
        role: 'system_admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 存储到localStorage作为临时解决方案
      localStorage.setItem('temp_user', JSON.stringify(tempUser));
      
      // 同时设置到Zustand store中
      setUser(tempUser as any);
      
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
              <Label htmlFor="identifier">账号</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="请输入邮箱或用户名"
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
            <Button type="submit" className="w-full border-0 bg-transparent hover:bg-accent hover{text-accent-foreground" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </div>
          {needsEmailConfirm && (
            <div className="mt-3 text-center">
              <Button type="default" onClick={handleResendConfirm} className="w-full">
                发送确认邮件
              </Button>
              <div className="text-xs text-gray-500 mt-2">若未收到邮件，请检查垃圾箱或联系管理员</div>
            </div>
          )}
        </form>
          
          {/* 演示/临时登录入口已禁用 */}
        </CardContent>
      </Card>
    </div>
  );
}
