import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

const Ranking: React.FC = () => {
  return (
    <div className="p-6">
      <Title level={2}>排行榜</Title>
      <Card>
        <p>排行榜页面正在开发中...</p>
      </Card>
    </div>
  );
};

export default Ranking;