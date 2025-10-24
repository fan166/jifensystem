import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Settings: React.FC = () => {
  return (
    <div className="p-6">
      <Card>
        <Title level={2}>系统设置</Title>
        <p>系统设置页面 - 开发中...</p>
      </Card>
    </div>
  );
};

export default Settings;