import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Upload,
  message,
  Progress,
  Card,
  Row,
  Col,
  Divider,
  Tag,
  Timeline,
  Rate,
  Space,
  Checkbox,
  DatePicker,
  InputNumber
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  StarOutlined,
  UserOutlined
} from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import dayjs from 'dayjs';

const { TextArea } = Input;

interface TaskCompletionConfirmationProps {
  visible: boolean;
  onCancel: () => void;
  keyWork: any;
  onSuccess: () => void;
}

interface CompletionData {
  completion_summary: string;
  completion_evidence: string[];
  actual_completion_date: string;
  final_completion_rate: number;
  lessons_learned: string;
  improvement_suggestions: string;
}

interface EvaluationCriteria {
  innovation_score: number;
  execution_score: number;
  collaboration_score: number;
  result_score: number;
  timeliness_score: number;
}

const TaskCompletionConfirmation: React.FC<TaskCompletionConfirmationProps> = ({
  visible,
  onCancel,
  keyWork,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [evaluationForm] = Form.useForm();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [evaluationResults, setEvaluationResults] = useState<any[]>([]);

  useEffect(() => {
    if (visible && keyWork) {
      fetchParticipants();
      form.setFieldsValue({
        actual_completion_date: dayjs(),
        final_completion_rate: 100
      });
    }
  }, [visible, keyWork]);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('key_work_participants')
        .select(`
          id,
          user_id,
          role,
          contribution_description,
          users!inner(id, name, department_id)
        `)
        .eq('key_work_id', keyWork.id);

      if (error) throw error;
      setParticipants(data || []);
      setSelectedParticipants(data?.map(p => p.id) || []);
    } catch (error) {
      console.error('获取参与人员失败:', error);
      message.error('获取参与人员失败');
    }
  };

  // 步骤1：提交完成报告
  const handleCompletionSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      const completionData: CompletionData = {
        completion_summary: values.completion_summary,
        completion_evidence: values.completion_evidence || [],
        actual_completion_date: values.actual_completion_date.format('YYYY-MM-DD'),
        final_completion_rate: values.final_completion_rate,
        lessons_learned: values.lessons_learned || '',
        improvement_suggestions: values.improvement_suggestions || ''
      };

      // 更新重点工作状态
      const { error: updateError } = await supabase
        .from('key_works')
        .update({
          status: 'completed',
          completion_rate: completionData.final_completion_rate,
          actual_completion_date: completionData.actual_completion_date,
          completion_summary: completionData.completion_summary,
          lessons_learned: completionData.lessons_learned,
          improvement_suggestions: completionData.improvement_suggestions
        })
        .eq('id', keyWork.id);

      if (updateError) throw updateError;

      setCompletionData(completionData);
      setCurrentStep(1);
      message.success('完成报告提交成功，请进行评价');
    } catch (error) {
      console.error('提交完成报告失败:', error);
      message.error('提交完成报告失败');
    } finally {
      setLoading(false);
    }
  };

  // 步骤2：提交评价
  const handleEvaluationSubmit = async (participantId: string, values: EvaluationCriteria & { evaluation_comments: string }) => {
    try {
      const totalScore = (
        values.innovation_score +
        values.execution_score +
        values.collaboration_score +
        values.result_score +
        values.timeliness_score
      ) / 5; // 平均分

      const evaluationData = {
        key_work_id: keyWork.id,
        participant_id: participantId,
        evaluator_id: user?.id,
        innovation_score: values.innovation_score,
        execution_score: values.execution_score,
        collaboration_score: values.collaboration_score,
        result_score: values.result_score,
        timeliness_score: values.timeliness_score,
        total_score: totalScore,
        evaluation_comments: values.evaluation_comments,
        evaluation_date: dayjs().format('YYYY-MM-DD')
      };

      const { error } = await supabase
        .from('key_work_evaluations')
        .insert([evaluationData]);

      if (error) throw error;

      // 更新参与者个人得分
      const { error: updateError } = await supabase
        .from('key_work_participants')
        .update({ individual_score: totalScore })
        .eq('id', participantId);

      if (updateError) throw updateError;

      setEvaluationResults(prev => [...prev, { participantId, ...evaluationData }]);
      message.success('评价提交成功');

      // 检查是否所有选中的参与者都已评价
      if (evaluationResults.length + 1 >= selectedParticipants.length) {
        setCurrentStep(2);
        message.success('所有评价已完成，任务闭环完成！');
      }
    } catch (error) {
      console.error('提交评价失败:', error);
      message.error('提交评价失败');
    }
  };

  const handleFinish = () => {
    onSuccess();
    onCancel();
    setCurrentStep(0);
    setCompletionData(null);
    setEvaluationResults([]);
    form.resetFields();
    evaluationForm.resetFields();
  };

  const renderCompletionForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleCompletionSubmit}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="actual_completion_date"
            label="实际完成日期"
            rules={[{ required: true, message: '请选择实际完成日期' }]}
          >
            <DatePicker className="w-full" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="final_completion_rate"
            label="最终完成度 (%)"
            rules={[{ required: true, message: '请输入完成度' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={5}
              className="w-full"
              formatter={value => `${value}%`}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="completion_summary"
        label="完成总结"
        rules={[{ required: true, message: '请输入完成总结' }]}
      >
        <TextArea
          rows={4}
          placeholder="请详细描述工作完成情况、主要成果和亮点"
        />
      </Form.Item>

      <Form.Item
        name="lessons_learned"
        label="经验教训"
      >
        <TextArea
          rows={3}
          placeholder="请总结在工作过程中的经验教训"
        />
      </Form.Item>

      <Form.Item
        name="improvement_suggestions"
        label="改进建议"
      >
        <TextArea
          rows={3}
          placeholder="对类似工作的改进建议"
        />
      </Form.Item>

      <div className="flex justify-end space-x-2">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交完成报告
        </Button>
      </div>
    </Form>
  );

  const renderEvaluationForm = () => (
    <div>
      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">参与人员评价</h3>
        <p className="text-gray-600">请对每位参与人员进行综合评价（1-5分制）</p>
      </div>

      <Checkbox.Group
        value={selectedParticipants}
        onChange={setSelectedParticipants}
        className="mb-4"
      >
        <Row gutter={[16, 16]}>
          {participants.map(participant => (
            <Col span={12} key={participant.id}>
              <Checkbox value={participant.id}>
                <Space>
                  <UserOutlined />
                  <span>{participant.users.name}</span>
                  <Tag color="blue">{participant.role}</Tag>
                </Space>
              </Checkbox>
            </Col>
          ))}
        </Row>
      </Checkbox.Group>

      {selectedParticipants.map(participantId => {
        const participant = participants.find(p => p.id === participantId);
        const isEvaluated = evaluationResults.some(r => r.participantId === participantId);
        
        if (!participant || isEvaluated) return null;

        return (
          <Card
            key={participantId}
            title={`评价：${participant.users.name}`}
            className="mb-4"
            size="small"
          >
            <Form
              layout="vertical"
              onFinish={(values) => handleEvaluationSubmit(participantId, values)}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="innovation_score"
                    label="创新能力"
                    rules={[{ required: true, message: '请评分' }]}
                  >
                    <Rate count={5} allowHalf />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="execution_score"
                    label="执行能力"
                    rules={[{ required: true, message: '请评分' }]}
                  >
                    <Rate count={5} allowHalf />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="collaboration_score"
                    label="协作能力"
                    rules={[{ required: true, message: '请评分' }]}
                  >
                    <Rate count={5} allowHalf />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="result_score"
                    label="结果质量"
                    rules={[{ required: true, message: '请评分' }]}
                  >
                    <Rate count={5} allowHalf />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="timeliness_score"
                    label="及时性"
                    rules={[{ required: true, message: '请评分' }]}
                  >
                    <Rate count={5} allowHalf />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="evaluation_comments"
                label="评价意见"
              >
                <TextArea rows={3} placeholder="请输入具体的评价意见" />
              </Form.Item>

              <div className="flex justify-end">
                <Button type="primary" htmlType="submit">
                  提交评价
                </Button>
              </div>
            </Form>
          </Card>
        );
      })}

      {evaluationResults.length >= selectedParticipants.length && (
        <div className="text-center mt-4">
          <Button type="primary" size="large" onClick={() => setCurrentStep(2)}>
            完成所有评价
          </Button>
        </div>
      )}
    </div>
  );

  const renderSummary = () => (
    <div className="text-center">
      <CheckCircleOutlined className="text-6xl text-green-500 mb-4" />
      <h2 className="text-2xl font-bold mb-4">任务闭环完成！</h2>
      
      <Card className="mb-4">
        <Timeline>
          <Timeline.Item dot={<FileTextOutlined />}>
            <div className="text-left">
              <div className="font-medium">完成报告已提交</div>
              <div className="text-gray-600 text-sm">
                完成度：{completionData?.final_completion_rate}%
              </div>
            </div>
          </Timeline.Item>
          <Timeline.Item dot={<StarOutlined />}>
            <div className="text-left">
              <div className="font-medium">评价已完成</div>
              <div className="text-gray-600 text-sm">
                已评价 {evaluationResults.length} 位参与人员
              </div>
            </div>
          </Timeline.Item>
          <Timeline.Item dot={<CheckCircleOutlined />}>
            <div className="text-left">
              <div className="font-medium">任务闭环</div>
              <div className="text-gray-600 text-sm">
                {dayjs().format('YYYY-MM-DD HH:mm')}
              </div>
            </div>
          </Timeline.Item>
        </Timeline>
      </Card>

      <Button type="primary" size="large" onClick={handleFinish}>
        确认完成
      </Button>
    </div>
  );

  const steps = [
    {
      title: '提交完成报告',
      content: renderCompletionForm()
    },
    {
      title: '评价参与人员',
      content: renderEvaluationForm()
    },
    {
      title: '完成闭环',
      content: renderSummary()
    }
  ];

  return (
    <Modal
      title="任务完成确认"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <div className="mb-6">
        <Progress
          percent={(currentStep + 1) * 33.33}
          steps={3}
          size="small"
        />
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>提交完成报告</span>
          <span>评价参与人员</span>
          <span>完成闭环</span>
        </div>
      </div>

      {steps[currentStep].content}
    </Modal>
  );
};

export default TaskCompletionConfirmation;