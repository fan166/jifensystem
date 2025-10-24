import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Profile: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <Title level={2}>个人中心</Title>
        <p>个人中心页面 - 开发中...</p>
      </Card>
    </div>
  );
};

export default Profile;