import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Tabs, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userAPI, departmentAPI } from '../services/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import PermissionWrapper from '../components/PermissionWrapper';
import type { User, Department } from '../lib/supabase';

const { Option } = Select;

interface UserWithDepartment extends User {
  department?: { name: string };
}

interface DepartmentWithCount extends Department {
  userCount?: number;
}

const Personnel: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [deptModalVisible, setDeptModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDepartment | null>(null);
  const [editingDept, setEditingDept] = useState<DepartmentWithCount | null>(null);
  const [form] = Form.useForm();
  const [deptForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserWithDepartment[]>([]);
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);

  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('write');

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, departmentsData] = await Promise.all([
        userAPI.getUsers(),
        departmentAPI.getDepartments()
      ]);
      
      // 计算每个部门的用户数量
      const deptWithCount = departmentsData.map(dept => ({
        ...dept,
        userCount: usersData.filter(user => user.department_id === dept.id).length
      }));
      
      setUsers(usersData);
      setDepartments(deptWithCount);
    } catch (error: any) {
      message.error(`加载数据失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const baseUserColumns: ColumnsType<User> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
    },
    {
      title: '部门',
      dataIndex: ['department', 'name'],
      key: 'department',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const roleMap = {
          system_admin: '系统管理员',
          assessment_admin: '考核办管理员',
          evaluator: '考核办管理员',
          leader: '分管领导',
          employee: '普通职工',
          admin: '系统管理员',
          manager: '考核办管理员'
        };
        return roleMap[role as keyof typeof roleMap] || role;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleDateString()
    },
    canManage ? {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteUser(record.id)}>删除</Button>
          <Button type="link" onClick={() => provisionAuthAccount(record)}>开通账号</Button>
        </Space>
      ),
    } : undefined as any,
  ];
  const userColumns = baseUserColumns.filter(Boolean) as ColumnsType<User>;

  const baseDeptColumns: ColumnsType<DepartmentWithCount> = [
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '人员数量',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count) => `${count || 0}人`
    },
    canManage ? {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditDepartment(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDepartment(record.id)}>删除</Button>
        </Space>
      ),
    } : undefined as any,
  ];
  const deptColumns = baseDeptColumns.filter(Boolean) as ColumnsType<DepartmentWithCount>;

  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalVisible(true);
  };

  const handleDeleteUser = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个用户吗？',
      onOk: async () => {
        try {
          await userAPI.deleteUser(id);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmitUser = async (values: any) => {
    try {
      const userData = {
        name: values.name,
        email: (values.email || '').trim(),
        position: values.position || null,
        department_id: values.departmentId,
        role: values.role
      };

      if (editingUser) {
        await userAPI.updateUser(editingUser.id, userData);
        message.success('编辑成功');
      } else {
        await userAPI.createUser(userData);
        message.success('添加成功');
      }
      
      setModalVisible(false);
      form.resetFields();
      setEditingUser(null);
      
      await loadData();
    } catch (error: any) {
      message.error(`操作失败: ${error.message || '未知错误'}`);
    }
  };

  const handleSubmitDepartment = async (values: any) => {
    try {
      const deptData = {
        name: values.name,
        description: values.description || '',
        updated_at: new Date().toISOString()
      };

      if (editingDept) {
        await departmentAPI.updateDepartment(editingDept.id, deptData);
        message.success('编辑成功');
      } else {
        await departmentAPI.createDepartment(deptData);
        message.success('添加成功');
      }
      
      setDeptModalVisible(false);
      deptForm.resetFields();
      setEditingDept(null);
      
      await loadData();
    } catch (error: any) {
      message.error(`操作失败: ${error.message || '未知错误'}`);
    }
  };

  const handleEditDepartment = (dept: DepartmentWithCount) => {
    setEditingDept(dept);
    deptForm.setFieldsValue({
      name: dept.name,
      description: dept.description
    });
    setDeptModalVisible(true);
  };

  const handleDeleteDepartment = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个部门吗？删除后不可恢复。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await departmentAPI.deleteDepartment(id);
          message.success('删除成功');
          loadData();
        } catch (error) {
          message.error('删除失败');
        }
      }
    });
  };

  const provisionAuthAccount = async (record: User) => {
    if (!record.email) {
      message.error('该用户未配置邮箱，无法开通账号');
      return;
    }
    try {
      // 生成随机密码（至少12位，包含大小写字母和数字）
      const generateRandomPassword = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        // 确保至少有一个大写字母、一个小写字母和一个数字
        password += chars[Math.floor(Math.random() * 26)]; // 大写字母
        password += chars[26 + Math.floor(Math.random() * 26)]; // 小写字母
        password += chars[52 + Math.floor(Math.random() * 10)]; // 数字
        // 填充到至少12位
        for (let i = password.length; i < 12; i++) {
          password += chars[Math.floor(Math.random() * chars.length)];
        }
        // 打乱字符顺序
        return password.split('').sort(() => Math.random() - 0.5).join('');
      };

      const randomPassword = generateRandomPassword();
      
      const { data, error } = await supabase.auth.signUp({
        email: record.email,
        password: randomPassword,
        options: {
          data: {
            name: record.name,
            role: record.role
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });
      
      if (error) {
        const msg = (error as any).message || '';
        if (/already registered/i.test(msg)) {
          message.success('账号已存在，无需重复开通');
        } else {
          message.error('开通账号失败：' + msg);
        }
        return;
      }
      
      // 发送密码重置邮件，让用户设置自己的密码
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(record.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      
      if (resetError) {
        message.warning('账号已开通，但发送密码重置邮件失败。请联系用户手动重置密码。');
      } else {
        message.success('账号已开通，密码重置邮件已发送到用户邮箱，请用户查收并设置密码');
      }
    } catch (e: any) {
      message.error('开通账号失败：' + (e.message || '未知错误'));
    }
  };

  const tabItems = [
    {
      key: 'users',
      label: '职工管理',
      children: (
        <div>
          <div className="mb-4">
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>添加用户</Button>
            )}
          </div>
          <Spin spinning={loading}>
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Spin>
        </div>
      )
    },
    {
      key: 'departments',
      label: '部门管理',
      children: (
        <div>
          <div className="mb-4">
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setEditingDept(null);
                deptForm.resetFields();
                setDeptModalVisible(true);
              }}>
                添加部门
              </Button>
            )}
          </div>
          <Spin spinning={loading}>
            <Table
              columns={deptColumns}
              dataSource={departments}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Spin>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      <PermissionWrapper permission="write">
        <Card title="人员管理" extra={<UserOutlined />}>
          <Tabs items={tabItems} />
        </Card>
      </PermissionWrapper>

      {/* 用户编辑模态框 */}
      {canManage && (
      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitUser}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, whitespace: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item
            name="position"
            label="职位"
          >
            <Input placeholder="请输入职位" />
          </Form.Item>

          <Form.Item
            name="departmentId"
            label="部门"
            rules={[{ required: true, message: '请选择部门' }]}
          >
            <Select placeholder="请选择部门">
              {departments.map(dept => (
                <Option key={dept.id} value={dept.id}>{dept.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="system_admin">系统管理员</Option>
                <Option value="assessment_admin">考核办管理员</Option>
              <Option value="employee">普通职工</Option>
            </Select>
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? '更新' : '添加'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      )}

      {/* 部门编辑模态框 */}
      {canManage && (
      <Modal
        title={editingDept ? '编辑部门' : '添加部门'}
        open={deptModalVisible}
        onCancel={() => setDeptModalVisible(false)}
        footer={null}
      >
        <Form
          form={deptForm}
          layout="vertical"
          onFinish={handleSubmitDepartment}
        >
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="部门描述"
          >
            <Input.TextArea placeholder="请输入部门描述" rows={3} />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setDeptModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                添加
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      )}
    </div>
  );
};

export default Personnel;
