import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Spin
} from 'antd';
import {
  TrophyOutlined,
  SearchOutlined,
  UserOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { supabase } from '../lib/supabase';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

// 数据类型定义
interface RankingData {
  id: string;
  name: string;
  department: string;
  avatar?: string;
  totalScore: number;
  basicScore: number;
  performanceScore: number;
  keyWorkScore: number;
  bonusScore: number;
  rank: number;
}

interface Statistics {
  totalPeople: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

const generateMockData = (): RankingData[] => {
  return [];
};

const Ranking: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<RankingData[]>([]);
  const currentYear = String(new Date().getFullYear());

  // 生成模拟数据
  const mockData = useMemo(() => generateMockData(), []);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        // 1) 获取最终绩效分
        let { data: fps, error: fpsErr } = await supabase
          .from('final_performance_scores')
          .select('*')
          .eq('period', currentYear);
        if (fpsErr) fps = [];

        // 若无最终分表数据，回退按测评记录计算
        let finalByUser = new Map<string, number>();
        if (fps && fps.length > 0) {
          for (const r of fps as any[]) {
            finalByUser.set(r.user_id, Number(r.final_score) || 0);
          }
        } else {
          const { data: evals } = await supabase
            .from('performance_evaluations')
            .select('evaluated_user_id, evaluation_type, total_score, status, period')
            .eq('period', currentYear)
            .in('status', ['approved','submitted']);
          const buckets = new Map<string, { sum: number; count: number }>();
          (evals || []).forEach(e => {
            const uid = (e as any).evaluated_user_id;
            if (!uid) return;
            const b = buckets.get(uid) || { sum: 0, count: 0 };
            b.sum += Number((e as any).total_score) || 0;
            b.count += 1;
            buckets.set(uid, b);
          });
          buckets.forEach((b, uid) => finalByUser.set(uid, Number((b.sum / Math.max(1, b.count)).toFixed(2))));
        }

        // 2) 获取奖励积分（加分）
        const { data: rewards } = await supabase
          .from('reward_score_records')
          .select('user_id, score');
        const bonusByUser = new Map<string, number>();
        (rewards || []).forEach(r => {
          const v = bonusByUser.get((r as any).user_id) || 0;
          bonusByUser.set((r as any).user_id, v + (Number((r as any).score) || 0));
        });

        // 3) 基本职责：按年聚合各月扣分，基础满分=20*参与月份数
        const { data: dutyScores } = await supabase
          .from('scores')
          .select('user_id, score, score_type_id, period');
        const dutyTypes = [/考勤|attendance/i, /学习|培训|learning|training/i, /纪律|违纪|discipline|violation/i];
        const basicDutyByUser = new Map<string, { deduction: number; months: Set<string> }>();
        (dutyScores || []).forEach(s => {
          const uid = (s as any).user_id;
          const type = String((s as any).score_type_id || '');
          const period = String((s as any).period || '');
          if (!uid || !period.startsWith(currentYear + '-')) return;
          if (!dutyTypes.some(rx => rx.test(type))) return;
          const bucket = basicDutyByUser.get(uid) || { deduction: 0, months: new Set<string>() };
          const val = Number((s as any).score) || 0;
          if (val < 0) bucket.deduction += Math.abs(val);
          bucket.months.add(period);
          basicDutyByUser.set(uid, bucket);
        });

        // 4) 关联用户与部门
        const userIds = Array.from(new Set([...finalByUser.keys(), ...bonusByUser.keys(), ...basicDutyByUser.keys()]));
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, department:departments(name), avatar')
          .in('id', userIds);
        const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

        // 若仍有缺失姓名的用户，尝试通过测评表反查姓名
        const missingIds = userIds.filter(uid => {
          const u = usersMap.get(uid);
          return !u || !u.name;
        });
        if (missingIds.length > 0) {
          const { data: evalUsers } = await supabase
            .from('performance_evaluations')
            .select('evaluated_user:users!performance_evaluations_evaluated_user_id_fkey(id,name,department:departments!users_department_id_fkey(name))')
            .in('evaluated_user_id', missingIds)
            .limit(1000);
          (evalUsers || []).forEach((row: any) => {
            const eu = row?.evaluated_user;
            if (eu?.id && !usersMap.has(eu.id)) {
              usersMap.set(eu.id, { id: eu.id, name: eu.name, department: eu.department });
            }
          });
        }

        // 5) 组装数据
        const rows: RankingData[] = userIds.map(uid => {
          const u = usersMap.get(uid) || {};
          const perf = finalByUser.get(uid) || 0;
          const bonus = bonusByUser.get(uid) || 0;
          const bd = basicDutyByUser.get(uid) || { deduction: 0, months: new Set<string>() };
          const baseFull = 20 * (bd.months.size || 1);
          const basic = Math.max(0, Number((baseFull - bd.deduction).toFixed(1)));
          const total = Number((perf + bonus).toFixed(1));
          return {
            id: uid,
            name: u.name || '用户',
            department: Array.isArray(u.department) ? (u.department?.[0]?.name || '-') : (u.department?.name || u.department || '-'),
            avatar: u.avatar,
            totalScore: Number((total + basic).toFixed(1)),
            basicScore: basic,
            performanceScore: perf,
            keyWorkScore: 0,
            bonusScore: bonus,
            rank: 0,
          };
        }).sort((a, b) => b.totalScore - a.totalScore);
        rows.forEach((r, i) => r.rank = i + 1);
        setData(rows);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [currentYear]);

  // 筛选和搜索逻辑
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
      const matchesDepartment = !selectedDepartment || item.department === selectedDepartment;
      return matchesSearch && matchesDepartment;
    });
  }, [data, searchText, selectedDepartment]);

  // 统计信息计算
  const statistics: Statistics = useMemo(() => {
    const scores = filteredData.map(item => item.totalScore);
    if (scores.length === 0) {
      return {
        totalPeople: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0
      };
    }
    return {
      totalPeople: filteredData.length,
      averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores)
    };
  }, [filteredData]);

  // 获取排名样式
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <span title="第一名" style={{ fontSize: '16px' }}>🥇</span>;
    } else if (rank === 2) {
      return <span title="第二名" style={{ fontSize: '16px' }}>🥈</span>;
    } else if (rank === 3) {
      return <span title="第三名" style={{ fontSize: '16px' }}>🥉</span>;
    }
    return <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#666' }}>{rank}</span>;
  };

  // 获取排名行样式
  const getRowClassName = (record: RankingData) => {
    if (record.rank === 1) return 'rank-first';
    if (record.rank === 2) return 'rank-second';
    if (record.rank === 3) return 'rank-third';
    return '';
  };

  // 表格列定义
  const columns: ColumnsType<RankingData> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      align: 'center',
      render: (rank: number) => getRankBadge(rank),
      sorter: (a, b) => a.rank - b.rank,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (name: string, record: RankingData) => (
        <Space>
          <Avatar 
            size="small" 
            src={record.avatar} 
            icon={<UserOutlined />}
          />
          <span style={{ fontWeight: record.rank <= 3 ? 'bold' : 'normal' }}>
            {name}
          </span>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 100,
      render: (department: string) => (
        <Tag color="blue">{department}</Tag>
      ),
      filters: Array.from(new Set(data.map(item => item.department))).map(dept => ({
        text: dept,
        value: dept,
      })),
      onFilter: (value, record) => record.department === value,
    },
    {
      title: '总积分',
      dataIndex: 'totalScore',
      key: 'totalScore',
      width: 100,
      align: 'center',
      render: (score: number, record: RankingData) => (
        <span 
          style={{ 
            fontSize: '16px',
            fontWeight: record.rank <= 3 ? 'bold' : 'normal',
            color: record.rank <= 3 ? '#1890ff' : '#333'
          }}
        >
          {score}
        </span>
      ),
      sorter: (a, b) => b.totalScore - a.totalScore,
      defaultSortOrder: 'descend',
    },
    {
      title: '基本职责',
      dataIndex: 'basicScore',
      key: 'basicScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => b.basicScore - a.basicScore,
    },
    {
      title: '工作实绩',
      dataIndex: 'performanceScore',
      key: 'performanceScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => b.performanceScore - a.performanceScore,
    },
    {
      title: '重点工作',
      dataIndex: 'keyWorkScore',
      key: 'keyWorkScore',
      width: 100,
      align: 'center',
      sorter: (a, b) => b.keyWorkScore - a.keyWorkScore,
    },
    {
      title: '奖励积分',
      dataIndex: 'bonusScore',
      key: 'bonusScore',
      width: 100,
      align: 'center',
      render: (score: number) => (
        <span style={{ color: score > 0 ? '#52c41a' : '#666' }}>
          {score > 0 && '+'}{score}
        </span>
      ),
      sorter: (a, b) => b.bonusScore - a.bonusScore,
    },
  ];

  return (
    <div className="p-6">
      <Title level={2} style={{ marginBottom: 24, display: 'flex', alignItems: 'center' }}>
        <TrophyOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        积分排行榜
      </Title>

      {/* 统计信息卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总人数"
              value={statistics.totalPeople}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="平均积分"
              value={statistics.averageScore}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="最高积分"
              value={statistics.highestScore}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="最低积分"
              value={statistics.lowestScore}
              prefix={<FallOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和搜索 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="搜索姓名"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="选择部门"
              style={{ width: '100%' }}
              value={selectedDepartment}
              onChange={setSelectedDepartment}
              allowClear
            >
              {Array.from(new Set(mockData.map(item => item.department))).map(dept => (
                <Option key={dept} value={dept}>{dept}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="每页显示"
              style={{ width: '100%' }}
              value={pageSize}
              onChange={setPageSize}
            >
              <Option value={10}>10条/页</Option>
              <Option value={20}>20条/页</Option>
              <Option value={50}>50条/页</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 排行榜表格 */}
      <Card>
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            rowClassName={getRowClassName}
            pagination={{
              pageSize,
              showSizeChanger: false,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
            }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: '暂无数据'
            }}
          />
        </Spin>
      </Card>

      {/* 自定义样式 */}
      <style>{`
        .rank-first {
          background: linear-gradient(90deg, #fff7e6 0%, #ffffff 100%);
          border-left: 4px solid #FFD700;
        }
        .rank-second {
          background: linear-gradient(90deg, #f6f6f6 0%, #ffffff 100%);
          border-left: 4px solid #C0C0C0;
        }
        .rank-third {
          background: linear-gradient(90deg, #fff2e8 0%, #ffffff 100%);
          border-left: 4px solid #CD7F32;
        }
        .ant-table-tbody > tr:hover > td {
          background: #e6f7ff !important;
        }
      `}</style>
    </div>
  );
};

export default Ranking;
