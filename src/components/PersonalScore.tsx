import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Progress,
  Space,
  Typography,
  Divider,
  Spin,
  Modal
} from 'antd';
import {
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface ScoreRecord {
  id: string;
  category: string;
  type: string;
  score: number;
  reason: string;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
}

interface PersonalScoreProps {
  visible: boolean;
  onClose: () => void;
}

const PersonalScore: React.FC<PersonalScoreProps> = ({ visible, onClose }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState({
    totalScore: 0,
    basicDuty: 0,
    workPerformance: 0,
    keyWork: 0,
    performanceReward: 0,
    ranking: 0,
    totalUsers: 0
  });
  const [recentRecords, setRecentRecords] = useState<ScoreRecord[]>([]);

  useEffect(() => {
    if (visible && user) {
      loadPersonalScore();
    }
  }, [visible, user]);

  const loadPersonalScore = async () => {
    setLoading(true);
    try {
      // 模拟API调用
      const mockScoreData = {
        totalScore: 285,
        basicDuty: 95,
        workPerformance: 78,
        keyWork: 67,
        performanceReward: 45,
        ranking: 12,
        totalUsers: 156
      };

      const mockRecords: ScoreRecord[] = [
        {
          id: '1',
          category: '基本职责',
          type: '考勤',
          score: 5,
          reason: '全勤奖励',
          date: '2024-01-15',
          status: 'approved'
        },
        {
          id: '2',
          category: '工作实绩',
          type: '项目完成',
          score: 15,
          reason: '按时完成季度项目',
          date: '2024-01-14',
          status: 'approved'
        },
        {
          id: '3',
          category: '重点工作',
          type: '专项任务',
          score: 20,
          reason: '优质完成重点工作任务',
          date: '2024-01-13',
          status: 'approved'
        },
        {
          id: '4',
          category: '绩效奖励',
          type: '月度奖励',
          score: 10,
          reason: '月度优秀员工',
          date: '2024-01-12',
          status: 'pending'
        },
        {
          id: '5',
          category: '基本职责',
          type: '纪律',
          score: -2,
          reason: '迟到扣分',
          date: '2024-01-11',
          status: 'approved'
        }
      ];

      setScoreData(mockScoreData);
      setRecentRecords(mockRecords);
    } catch (error) {
      console.error('加载个人积分失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnsType<ScoreRecord> = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      render: (date) => (
        <Space>
          <CalendarOutlined />
          {date}
        </Space>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category) => {
        const colorMap = {
          '基本职责': 'blue',
          '工作实绩': 'green',
          '重点工作': 'orange',
          '绩效奖励': 'purple'
        };
        return (
          <Tag color={colorMap[category as keyof typeof colorMap]}>
            {category}
          </Tag>
        );
      }
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100
    },
    {
      title: '积分',
      dataIndex: 'score',
      key: 'score',
      width: 80,
      render: (score) => (
        <span className={score > 0 ? 'text-green-600' : 'text-red-600'}>
          {score > 0 ? '+' : ''}{score}
        </span>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const statusMap = {
          approved: { color: 'green', text: '已确认' },
          pending: { color: 'orange', text: '待审核' },
          rejected: { color: 'red', text: '已拒绝' }
        };
        const config = statusMap[status as keyof typeof statusMap];
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    }
  ];

  const getRankingColor = (ranking: number, total: number) => {
    const percentage = (ranking / total) * 100;
    if (percentage <= 10) return '#52c41a'; // 绿色 - 前10%
    if (percentage <= 30) return '#1890ff'; // 蓝色 - 前30%
    if (percentage <= 60) return '#faad14'; // 黄色 - 前60%
    return '#f5222d'; // 红色 - 后40%
  };

  return (
    <Modal
      title={
        <span>
          <TrophyOutlined className="mr-2" />
          我的积分
        </span>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      className="personal-score-modal"
    >
      <Spin spinning={loading}>
        <div className="space-y-6">
        {/* 积分概览 */}
        <Card title="积分概览" size="small">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="总积分"
                value={scoreData.totalScore}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="排名"
                value={`${scoreData.ranking}/${scoreData.totalUsers}`}
                prefix={<RiseOutlined />}
                valueStyle={{ 
                  color: getRankingColor(scoreData.ranking, scoreData.totalUsers) 
                }}
              />
            </Col>
            <Col span={6}>
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">排名百分比</div>
                <Progress
                  type="circle"
                  size={60}
                  percent={Math.round((1 - scoreData.ranking / scoreData.totalUsers) * 100)}
                  strokeColor={getRankingColor(scoreData.ranking, scoreData.totalUsers)}
                />
              </div>
            </Col>
            <Col span={6}>
              <div className="text-center">
                <div className="text-gray-500 text-sm mb-1">本月趋势</div>
                <div className="text-green-600 text-lg font-semibold">+12</div>
                <div className="text-xs text-gray-400">较上月</div>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 分类积分 */}
        <Card title="分类积分" size="small">
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" className="text-center">
                <Statistic
                  title="基本职责"
                  value={scoreData.basicDuty}
                  valueStyle={{ color: '#1890ff' }}
                />
                <Progress 
                  percent={Math.round((scoreData.basicDuty / 100) * 100)} 
                  size="small" 
                  strokeColor="#1890ff"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="text-center">
                <Statistic
                  title="工作实绩"
                  value={scoreData.workPerformance}
                  valueStyle={{ color: '#52c41a' }}
                />
                <Progress 
                  percent={Math.round((scoreData.workPerformance / 100) * 100)} 
                  size="small" 
                  strokeColor="#52c41a"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="text-center">
                <Statistic
                  title="重点工作"
                  value={scoreData.keyWork}
                  valueStyle={{ color: '#faad14' }}
                />
                <Progress 
                  percent={Math.round((scoreData.keyWork / 100) * 100)} 
                  size="small" 
                  strokeColor="#faad14"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" className="text-center">
                <Statistic
                  title="绩效奖励"
                  value={scoreData.performanceReward}
                  valueStyle={{ color: '#722ed1' }}
                />
                <Progress 
                  percent={Math.round((scoreData.performanceReward / 100) * 100)} 
                  size="small" 
                  strokeColor="#722ed1"
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* 最近记录 */}
        <Card title="最近积分记录" size="small">
          <Table
            columns={columns}
            dataSource={recentRecords}
            rowKey="id"
            size="small"
            pagination={false}
            loading={loading}
            scroll={{ y: 200 }}
          />
        </Card>
        </div>
      </Spin>
    </Modal>
  );
};

export default PersonalScore;