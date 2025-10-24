import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Tabs, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { userAPI, departmentAPI } from '../services/api';
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

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('开始加载数据...');
    setLoading(true);
    try {
      console.log('调用API获取用户和部门数据...');
      const [usersData, departmentsData] = await Promise.all([
        userAPI.getUsers(),
        departmentAPI.getDepartments()
      ]);
      
      console.log('获取到的用户数据:', usersData);
      console.log('获取到的部门数据:', departmentsData);
      
      // 计算每个部门的用户数量
      const deptWithCount = departmentsData.map(dept => ({
        ...dept,
        userCount: usersData.filter(user => user.department_id === dept.id).length
      }));
      
      console.log('处理后的部门数据（包含用户数量）:', deptWithCount);
      
      setUsers(usersData);
      setDepartments(deptWithCount);
      console.log('数据设置完成');
    } catch (error) {
      console.error('加载数据失败 - 详细错误:', error);
      console.error('错误堆栈:', error.stack);
      if (error.message) {
        console.error('错误消息:', error.message);
      }
      message.error(`加载数据失败: ${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
      console.log('数据加载流程结束');
    }
  };

  const userColumns: ColumnsType<User> = [
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
          evaluator: '考核办管理员',
          leader: '分管领导',
          employee: '普通职工'
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteUser(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const deptColumns: ColumnsType<DepartmentWithCount> = [
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEditDepartment(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDepartment(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

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
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const handleSubmitUser = async (values: any) => {
    console.log('提交用户数据:', values);
    try {
      const userData = {
        name: values.name,
        email: values.email || null,
        position: values.position || null,
        department_id: values.departmentId,
        role: values.role
      };
      console.log('准备发送的用户数据:', userData);

      if (editingUser) {
        console.log('更新用户:', editingUser.id);
        const result = await userAPI.updateUser(editingUser.id, userData);
        console.log('更新用户结果:', result);
        message.success('编辑成功');
      } else {
        console.log('创建新用户');
        const result = await userAPI.createUser(userData);
        console.log('创建用户结果:', result);
        message.success('添加成功');
      }
      
      setModalVisible(false);
      form.resetFields();
      setEditingUser(null);
      
      console.log('开始重新加载数据...');
      await loadData();
      console.log('数据重新加载完成');
    } catch (error) {
      console.error('用户操作失败 - 详细错误信息:', error);
      console.error('错误堆栈:', error.stack);
      if (error.message) {
        console.error('错误消息:', error.message);
      }
      message.error(`操作失败: ${error.message || '未知错误'}`);
    }
  };

  const handleSubmitDepartment = async (values: any) => {
    console.log('提交部门数据:', values);
    try {
      const deptData = {
        name: values.name,
        description: values.description || '',
        updated_at: new Date().toISOString()
      };
      console.log('准备发送的部门数据:', deptData);

      if (editingDept) {
        console.log('更新部门:', editingDept.id);
        const result = await departmentAPI.updateDepartment(editingDept.id, deptData);
        console.log('更新部门结果:', result);
        message.success('编辑成功');
      } else {
        console.log('创建新部门');
        const result = await departmentAPI.createDepartment(deptData);
        console.log('创建部门结果:', result);
        message.success('添加成功');
      }
      
      setDeptModalVisible(false);
      deptForm.resetFields();
      setEditingDept(null);
      
      console.log('开始重新加载数据...');
      await loadData();
      console.log('数据重新加载完成');
    } catch (error) {
      console.error('部门操作失败 - 详细错误信息:', error);
      console.error('错误堆栈:', error.stack);
      if (error.message) {
        console.error('错误消息:', error.message);
      }
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
          console.error('删除失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const tabItems = [
    {
      key: 'users',
      label: '职工管理',
      children: (
        <div>
          <div className="mb-4">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddUser}>
              添加用户
            </Button>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingDept(null);
              deptForm.resetFields();
              setDeptModalVisible(true);
            }}>
              添加部门
            </Button>
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
      <Card title="人员管理" extra={<UserOutlined />}>
        <Tabs items={tabItems} />
      </Card>

      {/* 用户编辑模态框 */}
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

      {/* 部门编辑模态框 */}
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
    </div>
  );
};

export default Personnel;