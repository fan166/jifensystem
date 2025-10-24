import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmzwopyrnfaedowsdhlm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtendvcHlybmZhZWRvd3NkaGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNTc3MDEsImV4cCI6MjA3MDYzMzcwMX0.agzyhwVaOg72HE4aAIMi6ewDdf8Ryz0MWvTqefucEPU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserPermissions() {
  try {
    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('当前用户:', user);
    
    if (userError) {
      console.error('获取用户错误:', userError);
      return;
    }
    
    if (!user) {
      console.log('用户未登录');
      return;
    }
    
    // 获取用户详细信息
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
      
    console.log('用户数据:', userData);
    console.log('用户数据错误:', userDataError);
    
    // 检查权限
    const { data: permissionData, error: permissionError } = await supabase
      .rpc('check_user_permission', {
        permission_name: 'view_daily_evaluation'
      });
      
    console.log('权限检查结果:', permissionData);
    console.log('权限检查错误:', permissionError);
    
  } catch (error) {
    console.error('调试错误:', error);
  }
}

debugUserPermissions();