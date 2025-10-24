import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Evaluation: React.FC = () => {
  return (
    <div className="p-6">
      <Title level={2}>考核评价</Title>
      <Card>
        <p>考核评价页面正在开发中...</p>
      </Card>
    </div>
  );
};

export default Evaluation;