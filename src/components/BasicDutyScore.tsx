import React, { useState, useEffect } from 'react';
import { Card, Tabs, message } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, BookOutlined, ExclamationCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import AttendanceScore from './AttendanceScore';
import LearningScore from './LearningScore';
import DisciplineScore from './DisciplineScore';
import BasicDutyStats from './BasicDutyStats';
import { userAPI } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../lib/supabase';

// const { TabPane } = Tabs; // 已废弃，使用items属性

interface BasicDutyScoreProps {
  readonly?: boolean;
}

const BasicDutyScore: React.FC<BasicDutyScoreProps> = ({ readonly = false }) => {
  const { user, hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('stats');

  // 检查用户权限
  const canEdit = !readonly && hasPermission('write');
  const isEmployee = user?.role === 'employee';



  return (
    <Card title="基本职责积分管理">
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'stats',
            label: <span><BarChartOutlined />积分统计</span>,
            children: <BasicDutyStats currentUserId={isEmployee ? user?.id : undefined} />
          },
          {
            key: 'attendance',
            label: <span><ClockCircleOutlined />考勤管理</span>,
            children: <AttendanceScore readonly={!canEdit} currentUserId={isEmployee ? user?.id : undefined} />
          },
          {
            key: 'learning',
            label: <span><BookOutlined />学习管理</span>,
            children: <LearningScore readonly={!canEdit} currentUserId={isEmployee ? user?.id : undefined} />
          },
          {
            key: 'discipline',
            label: <span><ExclamationCircleOutlined />纪律管理</span>,
            children: <DisciplineScore readonly={!canEdit} currentUserId={isEmployee ? user?.id : undefined} />
          }
        ]}
      />
    </Card>
  );
};

export default BasicDutyScore;